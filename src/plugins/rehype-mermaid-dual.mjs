/**
 * Rehype plugin — pre-renders Mermaid diagrams at build time for both themes.
 *
 * For every ```mermaid code block the plugin:
 *   1. Renders an SVG with the **light** themeVariables
 *   2. Renders an SVG with the **dark** themeVariables
 *   3. Replaces the code block in the HAST with a `.mermaid-container` that
 *      holds both inline SVGs (`.mermaid-light` / `.mermaid-dark`), a hidden
 *      `<pre>` source block, and a "source" toggle button.
 *
 * CSS in prose.css toggles visibility via `[data-theme]`, so the switch is
 * instant — zero client-side Mermaid, zero re-render on theme change.
 *
 * Requires `mermaid-isomorphic` (Playwright + Chromium) at build time.
 */
import { fromHtml } from "hast-util-from-html";
import { visit } from "unist-util-visit";

const FONT_FAMILY = "'Inter Variable', 'Inter Fallback', system-ui, sans-serif";

const LIGHT_THEME_VARIABLES = {
  fontFamily: FONT_FAMILY,
  fontSize: "14px",
  primaryColor: "hsl(85, 20%, 92%)",
  primaryTextColor: "hsl(45, 30%, 22%)",
  primaryBorderColor: "hsl(85, 20%, 80%)",
  secondaryColor: "hsl(85, 20%, 94%)",
  secondaryTextColor: "hsl(45, 30%, 22%)",
  secondaryBorderColor: "hsl(85, 20%, 85%)",
  tertiaryColor: "hsl(85, 15%, 96%)",
  tertiaryTextColor: "hsl(45, 20%, 42%)",
  tertiaryBorderColor: "hsl(85, 20%, 88%)",
  lineColor: "hsl(45, 15%, 55%)",
  textColor: "hsl(45, 30%, 22%)",
  mainBkg: "hsl(85, 20%, 92%)",
  nodeBorder: "hsl(85, 20%, 80%)",
  clusterBkg: "hsl(85, 15%, 96%)",
  clusterBorder: "hsl(85, 20%, 88%)",
  titleColor: "hsl(55, 12%, 55%)",
  edgeLabelBackground: "hsl(85, 20%, 94%)",
  nodeTextColor: "hsl(45, 30%, 22%)",
  actorTextColor: "hsl(45, 30%, 22%)",
  actorBorder: "hsl(85, 20%, 80%)",
  actorBkg: "hsl(85, 20%, 92%)",
  activationBorderColor: "hsl(55, 10%, 65%)",
  activationBkgColor: "hsl(85, 20%, 94%)",
  signalColor: "hsl(45, 30%, 22%)",
  labelBoxBkgColor: "hsl(85, 20%, 92%)",
  labelBoxBorderColor: "hsl(85, 20%, 80%)",
  labelTextColor: "hsl(45, 30%, 22%)",
  loopTextColor: "hsl(45, 20%, 42%)",
  noteBkgColor: "hsl(85, 20%, 94%)",
  noteBorderColor: "hsl(55, 10%, 65%)",
  noteTextColor: "hsl(45, 30%, 22%)",
};

const DARK_THEME_VARIABLES = {
  fontFamily: FONT_FAMILY,
  fontSize: "14px",
  primaryColor: "hsl(30, 10%, 19%)",
  primaryTextColor: "hsl(45, 10%, 95%)",
  primaryBorderColor: "hsl(30, 10%, 28%)",
  secondaryColor: "hsl(30, 10%, 17%)",
  secondaryTextColor: "hsl(45, 10%, 95%)",
  secondaryBorderColor: "hsl(30, 10%, 26%)",
  tertiaryColor: "hsl(30, 10%, 15%)",
  tertiaryTextColor: "hsl(45, 10%, 75%)",
  tertiaryBorderColor: "hsl(30, 10%, 22%)",
  lineColor: "hsl(45, 10%, 60%)",
  textColor: "hsl(45, 10%, 95%)",
  mainBkg: "hsl(30, 10%, 19%)",
  nodeBorder: "hsl(30, 10%, 28%)",
  clusterBkg: "hsl(30, 10%, 15%)",
  clusterBorder: "hsl(30, 10%, 24%)",
  titleColor: "hsl(85, 60%, 88%)",
  edgeLabelBackground: "hsl(30, 12%, 18%)",
  nodeTextColor: "hsl(45, 10%, 95%)",
  actorTextColor: "hsl(45, 10%, 95%)",
  actorBorder: "hsl(30, 10%, 28%)",
  actorBkg: "hsl(30, 10%, 19%)",
  activationBorderColor: "hsl(85, 50%, 75%)",
  activationBkgColor: "hsl(30, 10%, 17%)",
  signalColor: "hsl(45, 10%, 95%)",
  labelBoxBkgColor: "hsl(30, 10%, 19%)",
  labelBoxBorderColor: "hsl(30, 10%, 28%)",
  labelTextColor: "hsl(45, 10%, 95%)",
  loopTextColor: "hsl(45, 10%, 75%)",
  noteBkgColor: "hsl(30, 10%, 17%)",
  noteBorderColor: "hsl(85, 50%, 75%)",
  noteTextColor: "hsl(45, 10%, 95%)",
};

function getTextContent(node) {
  if (node.type === "text") return node.value || "";
  if (node.children) return node.children.map(getTextContent).join("");
  return "";
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Ensure SVG has explicit width/height from its viewBox for CLS prevention. */
function ensureSvgDimensions(svg) {
  const vb = svg.match(/viewBox="\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*"/);
  if (!vb) return svg;
  const w = vb[3];
  const h = vb[4];
  return svg.replace(/<svg([^>]*)>/, (_match, attrs) => {
    const cleaned = attrs.replace(/\s*(?:width|height)="[^"]*"/g, "");
    return `<svg${cleaned} width="${w}" height="${h}">`;
  });
}

/** Lazy singleton — Chromium is launched once and reused across all pages. */
let rendererPromise = null;

function getRenderer() {
  if (!rendererPromise) {
    rendererPromise = import("mermaid-isomorphic").then((mod) => mod.createMermaidRenderer());
  }
  return rendererPromise;
}

export default function rehypeMermaidDual() {
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: single-pass tree transform with error handling
  return async (tree) => {
    // 1. Collect every mermaid code block
    const targets = [];

    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "pre") return;
      const code = node.children?.find((c) => c.tagName === "code");
      if (!code) return;

      const classes = Array.isArray(code.properties?.className) ? code.properties.className : [];

      if (classes.includes("language-mermaid")) {
        targets.push({ node, index, parent, source: getTextContent(code) });
      }
    });

    if (targets.length === 0) return;

    // 2. Obtain (or create) the Playwright-backed renderer
    const renderer = await getRenderer();

    // mermaid-isomorphic takes string[] (diagram source code)
    const sources = targets.map((t) => t.source);

    // 3. Render all diagrams in both themes in parallel
    const [lightResults, darkResults] = await Promise.all([
      renderer(sources, {
        mermaidConfig: {
          theme: "base",
          fontFamily: FONT_FAMILY,
          themeVariables: LIGHT_THEME_VARIABLES,
        },
      }),
      renderer(sources, {
        mermaidConfig: {
          theme: "base",
          fontFamily: FONT_FAMILY,
          themeVariables: DARK_THEME_VARIABLES,
        },
      }),
    ]);

    // 4. Replace each code block with a dual-SVG container
    //    (iterate in reverse so splice indices stay valid)
    for (let i = targets.length - 1; i >= 0; i--) {
      const { index, parent, source } = targets[i];

      const lightResult = lightResults[i];
      const darkResult = darkResults[i];

      // Extract SVG from PromiseSettledResult
      let lightSvg = lightResult?.status === "fulfilled" ? lightResult.value.svg : "";
      let darkSvg = darkResult?.status === "fulfilled" ? darkResult.value.svg : "";

      if (!(lightSvg && darkSvg)) {
        const reason = lightResult?.reason?.message ?? darkResult?.reason?.message ?? "unknown";
        // biome-ignore lint/suspicious/noConsole: build-time plugin, not client code
        console.warn(`[rehype-mermaid-dual] Failed to render diagram ${i}: ${reason}`);
        continue;
      }

      // Deduplicate SVG IDs — both renders share `mermaid-N`, add theme suffix.
      // Must replace ALL occurrences (root id attr + internal CSS selectors like #mermaid-0).
      const lightId = lightSvg.match(/id="(mermaid-\d+)"/)?.[1];
      const darkId = darkSvg.match(/id="(mermaid-\d+)"/)?.[1];
      if (lightId) lightSvg = lightSvg.replaceAll(lightId, `${lightId}-light`);
      if (darkId) darkSvg = darkSvg.replaceAll(darkId, `${darkId}-dark`);
      lightSvg = ensureSvgDimensions(lightSvg);
      darkSvg = ensureSvgDimensions(darkSvg);

      const html = [
        '<div class="mermaid-container">',
        '  <button class="mermaid-toggle" aria-label="View diagram source">source</button>',
        `  <div class="mermaid-rendered mermaid-light">${lightSvg}</div>`,
        `  <div class="mermaid-rendered mermaid-dark">${darkSvg}</div>`,
        `  <pre class="mermaid-source code-processed" hidden><code>${escapeHtml(source)}</code></pre>`,
        "</div>",
      ].join("");

      const fragment = fromHtml(html, { fragment: true });
      parent.children.splice(index, 1, ...fragment.children);
    }
  };
}
