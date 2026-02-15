/**
 * Design token lint script (Reflection Engine v3.0).
 *
 * Mathematically derives the design system rulebook directly from global.css.
 * Features:
 * - Dynamic Variable Resolution (resolves var() and calc() at runtime)
 * - Unit Normalization (handles rem/px equivalency automatically)
 * - Zero Hardcoding (linter adapts instantly to CSS changes)
 * - Exhaustive Multi-Value Auditing
 *
 * Usage: bun run scripts/lint-design.ts
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..", "src");
const GLOBAL_CSS_PATH = join(ROOT, "styles", "global.css");

// ---------------------------------------------------------------------------
// Dynamic Reflection Engine
// ---------------------------------------------------------------------------

interface TokenRegistry {
  spacing: Record<string, string>;
  colors: Record<string, string>;
  radius: Record<string, string>;
  zindex: Record<string, string>;
  timing: Record<string, string>;
  typography: Record<string, string>;
  breakpoints: Record<string, string>;
}

/**
 * Extracts raw variables from CSS content.
 */
function extractRawVars(css: string): Record<string, string> {
  const rawVars: Record<string, string> = {};
  const varRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: iterator pattern
  while ((match = varRegex.exec(css)) !== null) {
    if (match[1] && match[2]) {
      rawVars[match[1]] = match[2].trim();
    }
  }
  return rawVars;
}

/**
 * Recursively resolves CSS variables and basic math.
 */
function resolveValue(val: string, rawVars: Record<string, string>, depth = 0): string {
  if (depth > 5) return val;

  let resolved = val.replace(/var\(--([\w-]+)\)/g, (_, name) => {
    return rawVars[name] ? resolveValue(rawVars[name], rawVars, depth + 1) : `var(--${name})`;
  });

  resolved = resolved.replace(/calc\(([^)]+)\)/g, (_, expr) => {
    try {
      const parts = expr.match(/([0-9.]+)([a-z%]*)\s*([*+])\s*([0-9.]+)/);
      if (parts) {
        const n1 = parseFloat(parts[1]);
        const unit = parts[2];
        const op = parts[3];
        const n2 = parseFloat(parts[4]);
        return `${op === "*" ? n1 * n2 : n1 + n2}${unit}`;
      }
    } catch {
      /* fallback */
    }
    return expr;
  });

  return resolved;
}

/**
 * Populates the registry with resolved values and normalized units.
 */
function populateRegistry(registry: TokenRegistry, name: string, resolved: string) {
  const token = `var(--${name})`;

  if (name.startsWith("space-") || name === "grid") {
    registry.spacing[resolved] = token;
    if (resolved.endsWith("rem")) {
      registry.spacing[`${parseFloat(resolved) * 16}px`] = token;
    } else if (resolved.endsWith("px") && parseFloat(resolved) >= 4) {
      registry.spacing[`${parseFloat(resolved) / 16}rem`] = token;
    }
  } else if (name.startsWith("color-") || name === "hue") {
    registry.colors[resolved] = token;
  } else if (name.startsWith("radius-")) {
    registry.radius[resolved] = token;
  } else if (name.startsWith("z-")) {
    registry.zindex[resolved] = token;
  } else if (name.startsWith("duration-") || name.startsWith("ease-")) {
    registry.timing[resolved] = token;
  } else if (name.startsWith("font-size-")) {
    registry.typography[resolved] = token;
  } else if (name.startsWith("breakpoint-")) {
    registry.breakpoints[resolved] = token;
  }
}

/**
 * Orchestrates the building of the dynamic token registry.
 */
function buildDynamicRegistry(): TokenRegistry {
  const registry: TokenRegistry = {
    spacing: {},
    colors: {},
    radius: {},
    zindex: {},
    timing: {},
    typography: {},
    breakpoints: {},
  };

  try {
    const css = readFileSync(GLOBAL_CSS_PATH, "utf-8");
    const rawVars = extractRawVars(css);

    for (const [name, rawVal] of Object.entries(rawVars)) {
      populateRegistry(registry, name, resolveValue(rawVal, rawVars));
    }
  } catch (e) {
    console.error("Reflection Engine Error: Failed to parse global.css", e);
  }

  return registry;
}

const REGISTRY = buildDynamicRegistry();

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function collectFiles(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        results.push(...collectFiles(full, exts));
      } else if (exts.some((ext) => full.endsWith(ext))) {
        results.push(full);
      }
    }
  } catch {
    /* skip */
  }
  return results;
}

// ---------------------------------------------------------------------------
// Block-level exclusion
// ---------------------------------------------------------------------------

const EXCLUDED_BLOCK_RE = /^\s*@keyframes\b|^\s*@font-face\b|prefers-reduced-motion/;

function braceBalance(line: string): { opens: number; closes: number } {
  let opens = 0;
  let closes = 0;
  for (const ch of line) {
    if (ch === "{") opens++;
    if (ch === "}") closes++;
  }
  return { opens, closes };
}

function getExcludedLines(lines: string[]): Set<number> {
  const excluded = new Set<number>();
  let depth = 0;
  let excluding = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    if (!excluding && depth === 0 && EXCLUDED_BLOCK_RE.test(line)) excluding = true;
    if (excluding) excluded.add(i);
    const { opens, closes } = braceBalance(line);
    depth += opens - closes;
    if (excluding && depth <= 0) {
      excluded.add(i);
      excluding = false;
      depth = 0;
    }
  }
  return excluded;
}

interface Violation {
  file: string;
  line: number;
  raw: string;
  suggestion: string;
}

// ---------------------------------------------------------------------------
// Property Mappings
// ---------------------------------------------------------------------------

const COLOR_PROPS = new Set([
  "color",
  "background",
  "background-color",
  "background-image",
  "border",
  "border-color",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline",
  "outline-color",
  "text-decoration-color",
  "fill",
  "stroke",
  "caret-color",
  "accent-color",
  "column-rule-color",
  "box-shadow",
  "text-shadow",
]);

const SPACING_PROPS =
  /^\s*(?:margin|padding|gap|top|right|bottom|left|margin-top|margin-right|margin-bottom|margin-left|padding-top|padding-right|padding-bottom|padding-left|row-gap|column-gap|width|height|max-width|max-height|min-width|min-height|backdrop-filter|border-width|border|border-top|border-right|border-bottom|border-left|outline|transform|grid-template-columns|grid-template-rows|text-underline-offset|text-decoration-thickness|text-indent|contain-intrinsic-size|flex-basis|inset|scroll-padding|scroll-margin|outline-offset|aspect-ratio)\s*:/;

// ---------------------------------------------------------------------------
// Scanners
// ---------------------------------------------------------------------------

function scanSpacing(prop: string, value: string): Violation[] {
  if (/^[\s]*(0|auto|none|inherit|initial|unset|100%|50%)[\s;]*$/.test(value)) return [];
  const results: Violation[] = [];
  const regex = /(?<!var\([^)]*?|#|[0-9a-fA-F])\b([0-9.]+)(rem|px|em)\b/g;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: iterator pattern
  while ((match = regex.exec(value)) !== null) {
    const lit = match[0];
    if (REGISTRY.spacing[lit]) {
      let suggestion = REGISTRY.spacing[lit];
      if (/top|bottom/.test(prop)) suggestion += " or var(--space-y-*)";
      results.push({ file: "", line: 0, raw: `${prop}: ${lit}`, suggestion });
    }
  }
  return results;
}

function getCoreChecks(
  prop: string,
  value: string,
  line: string,
  rel: string,
  lineNum: number,
): Array<() => Violation[]> {
  return [
    () => (SPACING_PROPS.test(line) ? scanSpacing(prop, value) : []),
    () => {
      const v = value.replace(/;$/, "").trim();
      if (prop === "z-index" && REGISTRY.zindex[v])
        return [
          {
            file: rel,
            line: lineNum,
            raw: `z-index: ${v}`,
            suggestion: REGISTRY.zindex[v],
          },
        ];
      if (prop === "border-radius" && REGISTRY.radius[v])
        return [
          {
            file: rel,
            line: lineNum,
            raw: `border-radius: ${v}`,
            suggestion: REGISTRY.radius[v],
          },
        ];
      return [];
    },
    () => {
      if (!COLOR_PROPS.has(prop) || /var\(/.test(value)) return [];
      const v = value.replace(/;$/, "").trim();
      if (REGISTRY.colors[v])
        return [
          {
            file: rel,
            line: lineNum,
            raw: `${prop}: ${v}`,
            suggestion: REGISTRY.colors[v],
          },
        ];
      if (/(oklch|hsla?|rgba?)\(/.test(v) || /#[0-9a-fA-F]{3,8}\b/.test(v)) {
        return [
          {
            file: rel,
            line: lineNum,
            raw: `${prop}: ${v}`,
            suggestion: "Use a design token (var(--color-*))",
          },
        ];
      }
      return [];
    },
  ];
}

function getTypographyChecks(
  prop: string,
  value: string,
  rel: string,
  lineNum: number,
): Array<() => Violation[]> {
  return [
    () =>
      prop === "font-family" && !/var\(|inherit|initial|unset/.test(value)
        ? [
            {
              file: rel,
              line: lineNum,
              raw: `font-family: ${value}`,
              suggestion: "var(--font-*)",
            },
          ]
        : [],
    () =>
      prop === "font-size" &&
      !/var\(|clamp\(|calc\(|%|vh|vw|em|rem|inherit|initial|unset|smaller|larger|small|medium|large|x-small|x-large|xx-small|xx-large/.test(
        value,
      )
        ? [
            {
              file: rel,
              line: lineNum,
              raw: `font-size: ${value}`,
              suggestion: "var(--font-size-*)",
            },
          ]
        : [],
    () =>
      prop === "opacity" && !/var\(|0|1|inherit|initial|unset/.test(value)
        ? [
            {
              file: rel,
              line: lineNum,
              raw: `opacity: ${value}`,
              suggestion: "var(--opacity-*)",
            },
          ]
        : [],
    () =>
      prop === "letter-spacing" && !/var\(|normal|inherit|initial|unset/.test(value)
        ? [
            {
              file: rel,
              line: lineNum,
              raw: `letter-spacing: ${value}`,
              suggestion: "var(--letter-spacing-*)",
            },
          ]
        : [],
  ];
}

function processLine(rawLine: string, rel: string, i: number, lines: string[]): Violation[] {
  const violations: Violation[] = [];

  const mqResult = checkMediaQuery(rawLine, lines[i + 1]);
  if (mqResult) {
    mqResult.file = rel;
    mqResult.line = i + 1;
    violations.push(mqResult);
  }

  const line = rawLine.replace(/\/\*.*?\*\//g, "").replace(/\/\/.*$/, "");
  const propMatch = line.match(/^\s*([\w-]+)\s*:\s*(.+)/);
  if (!(propMatch?.[1] && propMatch[2])) return violations;

  const prop = propMatch[1];
  const value = propMatch[2];

  const checks = [
    ...getCoreChecks(prop, value, line, rel, i + 1),
    ...getTypographyChecks(prop, value, rel, i + 1),
  ];

  for (const check of checks) {
    for (const result of check()) {
      result.file = rel;
      result.line = i + 1;
      violations.push(result);
    }
  }

  return violations;
}

function scanFile(filepath: string): Violation[] {
  const rel = relative(join(ROOT, ".."), filepath);
  if (rel.endsWith("print.css") || rel.endsWith("global.css")) return [];
  const content = readFileSync(filepath, "utf-8");
  const lines = content.split("\n");
  const excludedLines = getExcludedLines(lines);
  const violations: Violation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] as string;
    if (
      excludedLines.has(i) ||
      rawLine.includes("token-exempt") ||
      /^\s*\/[/*]/.test(rawLine) ||
      /^\s*--[\w-]+\s*:/.test(rawLine)
    )
      continue;

    violations.push(...processLine(rawLine, rel, i, lines));
  }
  return violations;
}

function checkMediaQuery(line: string, nextLine?: string): Violation | null {
  if (!line.includes("@media")) return null;
  for (const [lit, token] of Object.entries(REGISTRY.breakpoints)) {
    if (line.includes(lit)) {
      const tokenStr = token as string;
      const comment = `/* @breakpoint-${tokenStr.replace("var(--breakpoint-", "").replace(")", "")} */`;
      if (line.includes(comment) || nextLine?.includes(comment)) return null;
      return {
        file: "",
        line: 0,
        raw: line.trim(),
        suggestion: `${tokenStr} (add comment ${comment} to acknowledge)`,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const files = collectFiles(ROOT, [".css", ".astro"]);
const allViolations: Violation[] = [];
for (const f of files) allViolations.push(...scanFile(f));

if (allViolations.length === 0) {
  console.log("Reflection Engine: Design System perfectly synced. Zero violations.");
  process.exit(0);
} else {
  for (const v of allViolations) console.log(`${v.file}:${v.line}  ${v.raw}  →  ${v.suggestion}`);
  console.log(
    `\nReflection Engine: Found ${allViolations.length} violation${allViolations.length === 1 ? "" : "s"}.`,
  );
  process.exit(1);
}
