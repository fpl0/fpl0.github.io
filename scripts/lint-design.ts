/**
 * Design token lint script.
 *
 * Scans .css and .astro files under src/ for hardcoded values that should use
 * design system tokens. Exit code 1 on violations, 0 when clean.
 *
 * Usage: bun run scripts/lint-tokens.ts
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..", "src");

// ---------------------------------------------------------------------------
// Token maps — hardcoded value -> suggested token
// ---------------------------------------------------------------------------

const SPACE_MAP: Record<string, string> = {
  "0.25rem": "var(--space-1)",
  "0.5rem": "var(--space-2)",
  "0.75rem": "var(--space-3)",
  "1rem": "var(--space-4)",
  "1.25rem": "var(--space-5)",
  "1.5rem": "var(--space-6)",
  "2rem": "var(--space-8)",
  "2.5rem": "var(--space-10)",
  "3rem": "var(--space-12)",
  "4rem": "var(--space-16)",
};

const Z_INDEX_MAP: Record<string, string> = {
  "1": "var(--z-base)",
  "10": "var(--z-float)",
  "20": "var(--z-dropdown)",
  "50": "var(--z-sticky)",
  "100": "var(--z-fixed)",
  "1000": "var(--z-overlay)",
  "1010": "var(--z-modal)",
  "9000": "var(--z-toast)",
};

const RADIUS_MAP: Record<string, string> = {
  "4px": "var(--radius-sm)",
  "6px": "var(--radius-md)",
  "8px": "var(--radius-lg)",
  "12px": "var(--radius-xl)",
  "999px": "var(--radius-full)",
  "50%": "var(--radius-round)",
};

const DURATION_MAP: Record<string, string> = {
  "0.15s": "var(--duration-fast)",
  "0.2s": "var(--duration-normal)",
  "0.3s": "var(--duration-slow)",
  "150ms": "var(--duration-fast)",
  "200ms": "var(--duration-normal)",
  "300ms": "var(--duration-slow)",
};

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function collectFiles(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectFiles(full, exts));
    } else if (exts.some((ext) => full.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Block-level exclusion helpers
// ---------------------------------------------------------------------------

/** Returns line indices that fall inside @keyframes, @font-face, or @media (prefers-reduced-motion) blocks. */
function getExcludedLines(lines: string[]): Set<number> {
  const excluded = new Set<number>();
  let depth = 0;
  let excluding = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (
      !excluding &&
      depth === 0 &&
      (/^\s*@keyframes\b/.test(line) ||
        /^\s*@font-face\b/.test(line) ||
        /prefers-reduced-motion/.test(line))
    ) {
      excluding = true;
    }

    if (excluding) {
      excluded.add(i);
    }

    // Track brace depth within excluded blocks
    for (const ch of line) {
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (excluding && depth <= 0) {
          excluded.add(i);
          excluding = false;
          depth = 0;
        }
      }
    }
  }
  return excluded;
}

// ---------------------------------------------------------------------------
// Violation interface
// ---------------------------------------------------------------------------

interface Violation {
  file: string;
  line: number;
  raw: string;
  suggestion: string;
}

// ---------------------------------------------------------------------------
// Color properties — properties that accept color values
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
  "box-shadow",
  "text-decoration-color",
  "fill",
  "stroke",
  "caret-color",
  "accent-color",
  "column-rule-color",
]);

// ---------------------------------------------------------------------------
// Checkers
// ---------------------------------------------------------------------------

const SPACING_PROPS =
  /^\s*(?:margin|padding|gap|top|right|bottom|left|margin-top|margin-right|margin-bottom|margin-left|padding-top|padding-right|padding-bottom|padding-left|row-gap|column-gap)\s*:/;

function checkSpacing(prop: string, value: string): { raw: string; suggestion: string } | null {
  // Skip values that already use var(), or are 0/auto/none/negative/calc/clamp
  if (/var\(/.test(value)) return null;
  if (/^[\s]*(0|auto|none|inherit|initial|unset)[\s;]*$/.test(value)) return null;
  if (/calc\(|clamp\(/.test(value)) return null;

  // Extract individual values from shorthand (e.g. "1rem 2rem")
  const parts = value.replace(/;$/, "").trim().split(/\s+/);
  for (const part of parts) {
    // Skip em values (intentionally relative), percentages, vh/vw, negative values
    if (/em$/.test(part) && !/rem$/.test(part)) continue;
    if (/%$/.test(part)) continue;
    if (/v[hw]$/.test(part)) continue;
    if (part.startsWith("-")) continue;
    if (part === "0") continue;

    if (SPACE_MAP[part]) {
      return {
        raw: `${prop}: ${value.trim().replace(/;$/, "")}`,
        suggestion: SPACE_MAP[part],
      };
    }
  }
  return null;
}

function checkZIndex(value: string): { raw: string; suggestion: string } | null {
  if (/var\(/.test(value)) return null;
  const num = value.replace(/;$/, "").trim();
  if (
    num === "0" ||
    num === "auto" ||
    num === "-1" ||
    num === "inherit" ||
    num === "initial" ||
    num === "unset"
  )
    return null;
  // Negative z-index is fine
  if (num.startsWith("-")) return null;
  if (Z_INDEX_MAP[num]) {
    return {
      raw: `z-index: ${num}`,
      suggestion: Z_INDEX_MAP[num],
    };
  }
  return null;
}

function checkBorderRadius(value: string): { raw: string; suggestion: string } | null {
  if (/var\(/.test(value)) return null;
  const v = value.replace(/;$/, "").trim();
  if (v === "0" || v === "none" || v === "inherit" || v === "initial" || v === "unset") return null;
  // Check each part of shorthand
  const parts = v.split(/[\s/]+/);
  for (const part of parts) {
    if (RADIUS_MAP[part]) {
      return {
        raw: `border-radius: ${v}`,
        suggestion: RADIUS_MAP[part],
      };
    }
  }
  return null;
}

function checkTransitionDuration(fullLine: string): { raw: string; suggestion: string } | null {
  if (/var\(--duration/.test(fullLine)) return null;
  // Look for hardcoded durations in transition/animation properties
  for (const [lit, token] of Object.entries(DURATION_MAP)) {
    // Match the duration as a standalone value (not inside a var() or part of another number)
    const escaped = lit.replace(".", "\\.");
    const re = new RegExp(`(?<!var\\([^)]*?)\\b${escaped}\\b`);
    if (re.test(fullLine)) {
      return {
        raw: fullLine.trim().replace(/;$/, ""),
        suggestion: token,
      };
    }
  }
  return null;
}

function checkEasing(fullLine: string): { raw: string; suggestion: string } | null {
  if (/var\(--ease/.test(fullLine)) return null;
  // Check for hardcoded cubic-bezier matching our tokens
  if (/cubic-bezier\(\s*0\.16\s*,\s*1\s*,\s*0\.3\s*,\s*1\s*\)/.test(fullLine)) {
    return {
      raw: fullLine.trim().replace(/;$/, ""),
      suggestion: "var(--ease-out)",
    };
  }
  if (/cubic-bezier\(\s*0\.175\s*,\s*0\.885\s*,\s*0\.32\s*,\s*1\.275\s*\)/.test(fullLine)) {
    return {
      raw: fullLine.trim().replace(/;$/, ""),
      suggestion: "var(--ease-spring)",
    };
  }
  return null;
}

function checkColor(prop: string, value: string): { raw: string; suggestion: string } | null {
  if (!COLOR_PROPS.has(prop)) return null;
  // Already using a var()? Skip
  if (/var\(--color/.test(value) || /var\(--shadow/.test(value)) return null;
  const v = value.replace(/;$/, "").trim();
  if (
    v === "none" ||
    v === "transparent" ||
    v === "inherit" ||
    v === "initial" ||
    v === "unset" ||
    v === "currentColor" ||
    v === "currentcolor"
  )
    return null;

  // Flag raw color functions
  if (/hsla?\(/.test(v) || /rgba?\(/.test(v)) {
    return {
      raw: `${prop}: ${v}`,
      suggestion: "var(--color-*)",
    };
  }
  // Flag hex colors
  if (/#[0-9a-fA-F]{3,8}\b/.test(v)) {
    return {
      raw: `${prop}: ${v}`,
      suggestion: "var(--color-*)",
    };
  }
  // Flag white/black keywords (as standalone values or in shorthand)
  if (/\bwhite\b/.test(v) || /\bblack\b/.test(v)) {
    return {
      raw: `${prop}: ${v}`,
      suggestion: "var(--color-*)",
    };
  }
  return null;
}

function checkFontFamily(value: string): { raw: string; suggestion: string } | null {
  if (/var\(--font/.test(value)) return null;
  const v = value.replace(/;$/, "").trim();
  if (v === "inherit" || v === "initial" || v === "unset") return null;
  return {
    raw: `font-family: ${v}`,
    suggestion: "var(--font-*)",
  };
}

function checkFontSize(value: string): { raw: string; suggestion: string } | null {
  if (/var\(--font-size/.test(value)) return null;
  const v = value.replace(/;$/, "").trim();
  if (v === "inherit" || v === "initial" || v === "unset" || v === "0") return null;
  // Allow em values (intentionally relative to parent context)
  if (/em$/.test(v) && !/rem$/.test(v)) return null;
  // Allow percentage and viewport units
  if (/%$/.test(v) || /v[hw]$/.test(v)) return null;
  // Allow clamp/calc (likely a responsive scale)
  if (/clamp\(|calc\(/.test(v)) return null;
  // Allow keywords
  if (/^(smaller|larger|small|medium|large|x-small|x-large|xx-small|xx-large)$/.test(v))
    return null;
  return {
    raw: `font-size: ${v}`,
    suggestion: "var(--font-size-*)",
  };
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

function scanFile(filepath: string): Violation[] {
  const violations: Violation[] = [];
  const content = readFileSync(filepath, "utf-8");
  const lines = content.split("\n");
  const excludedLines = getExcludedLines(lines);
  const rel = relative(join(ROOT, ".."), filepath);

  // Skip print.css entirely
  if (rel.endsWith("print.css")) return [];

  // Track if we're inside a CSS variable definition block (:root or [data-theme])
  let inVarBlock = false;
  let varBlockDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track variable definition blocks
    if (/^\s*:root\b/.test(line) || /^\s*\[data-theme/.test(line)) {
      inVarBlock = true;
      varBlockDepth = 0;
    }
    if (inVarBlock) {
      for (const ch of line) {
        if (ch === "{") varBlockDepth++;
        if (ch === "}") {
          varBlockDepth--;
          if (varBlockDepth <= 0) {
            inVarBlock = false;
            varBlockDepth = 0;
          }
        }
      }
    }

    // Skip: excluded blocks, variable definitions, comments, empty, token-exempt
    if (excludedLines.has(i)) continue;
    if (inVarBlock) continue;
    if (/\/\*\s*token-exempt\s*\*\//.test(line)) continue;
    if (/^\s*\/[/*]/.test(line)) continue;
    if (/^\s*\*/.test(line)) continue;
    if (/^\s*$/.test(line)) continue;
    // Skip lines that are CSS variable declarations (--foo: value)
    if (/^\s*--[\w-]+\s*:/.test(line)) continue;

    // Extract property: value from the line
    const propMatch = line.match(/^\s*([\w-]+)\s*:\s*(.+)/);
    if (!propMatch) continue;
    const [, prop, value] = propMatch;

    // Spacing check
    if (SPACING_PROPS.test(line)) {
      const v = checkSpacing(prop, value);
      if (v) violations.push({ file: rel, line: i + 1, ...v });
    }

    // Z-index check
    if (prop === "z-index") {
      const v = checkZIndex(value);
      if (v) violations.push({ file: rel, line: i + 1, ...v });
    }

    // Border-radius check
    if (prop === "border-radius") {
      const v = checkBorderRadius(value);
      if (v) violations.push({ file: rel, line: i + 1, ...v });
    }

    // Transition duration/easing check
    if (
      prop === "transition" ||
      prop === "transition-duration" ||
      prop === "animation" ||
      prop === "animation-duration"
    ) {
      const vd = checkTransitionDuration(line);
      if (vd) violations.push({ file: rel, line: i + 1, ...vd });
      const ve = checkEasing(line);
      if (ve) violations.push({ file: rel, line: i + 1, ...ve });
    }

    // Color check
    const vc = checkColor(prop, value);
    if (vc) violations.push({ file: rel, line: i + 1, ...vc });

    // Font-family check
    if (prop === "font-family") {
      const vf = checkFontFamily(value);
      if (vf) violations.push({ file: rel, line: i + 1, ...vf });
    }

    // Font-size check
    if (prop === "font-size") {
      const vs = checkFontSize(value);
      if (vs) violations.push({ file: rel, line: i + 1, ...vs });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const files = collectFiles(ROOT, [".css", ".astro"]);
const allViolations: Violation[] = [];

for (const f of files) {
  allViolations.push(...scanFile(f));
}

if (allViolations.length === 0) {
  console.log("No hardcoded token violations found.");
  process.exit(0);
} else {
  for (const v of allViolations) {
    console.log(`${v.file}:${v.line}  ${v.raw}  →  ${v.suggestion}`);
  }
  console.log(
    `\nFound ${allViolations.length} hardcoded token violation${allViolations.length === 1 ? "" : "s"}. Use design system tokens instead.`,
  );
  process.exit(1);
}
