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
  "1px": "var(--space-px)",
  "1.5px": "var(--space-0-375)",
  "2px": "var(--space-0-5)",
  "3px": "var(--space-0-75)",
  "0.25rem": "var(--space-1)",
  "4px": "var(--space-1)",
  "5px": "var(--space-1-25)",
  "0.5rem": "var(--space-2)",
  "8px": "var(--space-2)",
  "10px": "var(--space-2-5)",
  "0.75rem": "var(--space-3)",
  "12px": "var(--space-3)",
  "14px": "var(--space-3-5)",
  "1rem": "var(--space-4)",
  "16px": "var(--space-4)",
  "1.125rem": "var(--space-4-5)",
  "18px": "var(--space-4-5)",
  "1.25rem": "var(--space-5)",
  "20px": "var(--space-5)",
  "1.5rem": "var(--space-6)",
  "24px": "var(--space-6)",
  "1.75rem": "var(--space-7)",
  "28px": "var(--space-7)",
  "2rem": "var(--space-8)",
  "32px": "var(--space-8)",
  "2.25rem": "var(--space-9)",
  "36px": "var(--space-9)",
  "2.5rem": "var(--space-10)",
  "40px": "var(--space-10)",
  "2.75rem": "var(--space-11)",
  "44px": "var(--space-11)",
  "3rem": "var(--space-12)",
  "48px": "var(--space-12)",
  "3.5rem": "var(--space-14)",
  "56px": "var(--space-14)",
  "4rem": "var(--space-16)",
  "64px": "var(--space-16)",
  "4.25rem": "var(--space-17)",
  "68px": "var(--space-17)",
  "4.5rem": "var(--space-18)",
  "72px": "var(--space-18)",
  "6rem": "var(--space-24)",
  "96px": "var(--space-24)",
  "8rem": "var(--space-32)",
  "128px": "var(--space-32)",
  "9rem": "var(--space-36)",
  "144px": "var(--space-36)",
  "9.375rem": "var(--space-37-5)",
  "150px": "var(--space-37-5)",
  "13.75rem": "var(--space-55)",
  "220px": "var(--space-55)",
  "20rem": "var(--space-80)",
  "320px": "var(--space-80)",
  "25rem": "var(--space-100)",
  "400px": "var(--space-100)",
  "31.25rem": "var(--space-125)",
  "500px": "var(--space-125)",
  "35rem": "var(--space-140)",
  "560px": "var(--space-140)",
};

const BREAKPOINT_MAP: Record<string, string> = {
  "600px": "var(--breakpoint-mobile)",
};

const SHADOW_MAP: Record<string, string> = {
  "0 1px 2px 0 var(--shadow-color)": "var(--shadow-sm)",
  "0 4px 6px -1px var(--shadow-color)": "var(--shadow-md)",
  "0 10px 15px -3px var(--shadow-color)": "var(--shadow-lg)",
  "0 25px 50px -12px var(--shadow-color)": "var(--shadow-xl)",
  "0 2px 8px var(--shadow-color)": "var(--shadow-md) (closest match)",
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

const LINE_HEIGHT_MAP: Record<string, string> = {
  "1.1": "var(--line-height-tight)",
  "1.25": "var(--line-height-snug)",
  "1.4": "var(--line-height-subhead)",
  "1.5": "var(--line-height-normal)",
  "1.6": "var(--line-height-relaxed)",
  "1.7": "var(--line-height-loose)",
};

const OPACITY_MAP: Record<string, string> = {
  "0.35": "var(--opacity-subtle)",
  "0.5": "var(--opacity-muted)",
  "0.6": "var(--opacity-recede)",
  "0.8": "var(--opacity-de-emphasize)",
  "0.9": "var(--opacity-hover)",
};

const LETTER_SPACING_MAP: Record<string, string> = {
  "-0.04em": "var(--letter-spacing-extra-tight)",
  "-0.03em": "var(--letter-spacing-tight)",
  "-0.02em": "var(--letter-spacing-snug)",
  "-0.01em": "var(--letter-spacing-tighter)",
  "0": "var(--letter-spacing-normal)",
  "0.02em": "var(--letter-spacing-slight)",
  "0.04em": "var(--letter-spacing-loose)",
  "0.05em": "var(--letter-spacing-loose) (closest match)",
  "0.06em": "var(--letter-spacing-wide)",
  "0.08em": "var(--letter-spacing-extra)",
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

const EXCLUDED_BLOCK_RE = /^\s*@keyframes\b|^\s*@font-face\b|prefers-reduced-motion/;

/** Check whether a line starts an excluded block (at top-level depth). */
function isExcludedBlockStart(line: string): boolean {
  return EXCLUDED_BLOCK_RE.test(line);
}

/** Count brace balance in a line, returning the net depth change. */
function braceBalance(line: string): { opens: number; closes: number } {
  let opens = 0;
  let closes = 0;
  for (const ch of line) {
    if (ch === "{") opens++;
    if (ch === "}") closes++;
  }
  return { opens, closes };
}

/** Returns line indices that fall inside @keyframes, @font-face, or @media (prefers-reduced-motion) blocks. */
function getExcludedLines(lines: string[]): Set<number> {
  const excluded = new Set<number>();
  let depth = 0;
  let excluding = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;

    if (!excluding && depth === 0 && isExcludedBlockStart(line)) {
      excluding = true;
    }

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
  /^\s*(?:margin|padding|gap|top|right|bottom|left|margin-top|margin-right|margin-bottom|margin-left|padding-top|padding-right|padding-bottom|padding-left|row-gap|column-gap|width|height|max-width|max-height|min-width|min-height|backdrop-filter|border-width|border|border-top|border-right|border-bottom|border-left|outline|transform|grid-template-columns|grid-template-rows|text-underline-offset|text-decoration-thickness|text-indent|contain-intrinsic-size|flex-basis|inset)\s*:/;

function checkSpacing(prop: string, value: string): { raw: string; suggestion: string } | null {
  if (/^[\s]*(0|auto|none|inherit|initial|unset)[\s;]*$/.test(value)) return null;

  // Search for standalone token-matching values (rem or px)
  for (const [lit, token] of Object.entries(SPACE_MAP)) {
    const escaped = lit.replace(".", "\\.");
    // Match the value as a standalone word, not inside a var() and not part of another number
    const re = new RegExp(`(?<!var\\([^)]*?|\\.|[0-9])\\b${escaped}\\b`);
    if (re.test(value)) {
      return {
        raw: `${prop}: ${value.trim().replace(/;$/, "")}`,
        suggestion: token,
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
  if (/oklch?\(/.test(v) || /hsla?\(/.test(v) || /rgba?\(/.test(v)) {
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

function checkShadow(value: string): { raw: string; suggestion: string } | null {
  if (/var\(--shadow-/.test(value)) return null;
  const v = value.replace(/;$/, "").trim();
  if (v === "none" || v === "inherit" || v === "initial" || v === "unset") return null;

  // Exact match from map
  if (SHADOW_MAP[v]) {
    return {
      raw: `box-shadow: ${v}`,
      suggestion: SHADOW_MAP[v],
    };
  }

  // If it's a raw value not in the map, flag it
  if (!/var\(/.test(v)) {
    return {
      raw: `box-shadow: ${v}`,
      suggestion: "var(--shadow-*)",
    };
  }
  return null;
}

function checkLineHeight(value: string): { raw: string; suggestion: string } | null {
  if (/var\(--line-height/.test(value)) return null;
  const v = value.replace(/;$/, "").trim();
  if (v === "normal" || v === "inherit" || v === "initial" || v === "unset" || v === "1")
    return null;
  if (LINE_HEIGHT_MAP[v]) {
    return {
      raw: `line-height: ${v}`,
      suggestion: LINE_HEIGHT_MAP[v],
    };
  }
  return null;
}

function checkOpacity(value: string): { raw: string; suggestion: string } | null {
  if (/var\(--opacity/.test(value)) return null;
  const v = value.replace(/;$/, "").trim();
  if (v === "0" || v === "1" || v === "inherit" || v === "initial" || v === "unset") return null;
  if (OPACITY_MAP[v]) {
    return {
      raw: `opacity: ${v}`,
      suggestion: OPACITY_MAP[v],
    };
  }
  return null;
}

function checkLetterSpacing(value: string): { raw: string; suggestion: string } | null {
  if (/var\(--letter-spacing/.test(value)) return null;
  const v = value.replace(/;$/, "").trim();
  if (v === "normal" || v === "inherit" || v === "initial" || v === "unset") return null;
  if (LETTER_SPACING_MAP[v]) {
    return {
      raw: `letter-spacing: ${v}`,
      suggestion: LETTER_SPACING_MAP[v],
    };
  }
  return null;
}

function checkMediaQuery(
  line: string,
  nextLine?: string,
): { raw: string; suggestion: string } | null {
  if (!line.includes("@media")) return null;
  // Search for standalone token-matching values
  for (const [lit, token] of Object.entries(BREAKPOINT_MAP)) {
    const escaped = lit.replace(".", "\\.");
    const re = new RegExp(`\\b${escaped}\\b`);
    if (re.test(line)) {
      const comment = `/* @breakpoint-${token.replace("var(--breakpoint-", "").replace(")", "")} */`;
      // If it has the required comment on the same line or next line, it's allowed
      if (line.includes(comment) || (nextLine && nextLine.includes(comment))) {
        return null;
      }
      return {
        raw: line.trim(),
        suggestion: `${token} (add comment ${comment} to acknowledge)`,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

/** Track CSS variable definition blocks (:root, [data-theme]) and mark lines inside them. */
function getVarBlockLines(lines: string[]): Set<number> {
  const varLines = new Set<number>();
  let inBlock = false;
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;

    if (/^\s*:root\b/.test(line) || /^\s*\[data-theme/.test(line)) {
      inBlock = true;
      depth = 0;
    }

    if (inBlock) {
      varLines.add(i);
      const { opens, closes } = braceBalance(line);
      depth += opens - closes;
      if (depth <= 0) {
        inBlock = false;
        depth = 0;
      }
    }
  }
  return varLines;
}

/** Check if a line should be skipped entirely (comments, empty, exempt, var declarations). */
function isSkippableLine(line: string): boolean {
  if (/\/\*\s*token-exempt\s*\*\//.test(line)) return true;
  if (/^\s*\/[/*]/.test(line)) return true;
  if (/^\s*\*/.test(line)) return true;
  if (/^\s*$/.test(line)) return true;
  if (/^\s*--[\w-]+\s*:/.test(line)) return true;
  return false;
}

const TIMING_PROPS = new Set([
  "transition",
  "transition-duration",
  "animation",
  "animation-duration",
]);

type CheckResult = { raw: string; suggestion: string } | null;
type TokenChecker = (prop: string, value: string, line: string) => CheckResult[];

/** Build a list of token checkers to run against each declaration. */
const TOKEN_CHECKERS: TokenChecker[] = [
  (prop, value, line) => (SPACING_PROPS.test(line) ? [checkSpacing(prop, value)] : []),
  (prop, value) => (prop === "z-index" ? [checkZIndex(value)] : []),
  (prop, value) => (prop === "border-radius" ? [checkBorderRadius(value)] : []),
  (_prop, _value, line) =>
    TIMING_PROPS.has(_prop) ? [checkTransitionDuration(line), checkEasing(line)] : [],
  (prop, value) => [checkColor(prop, value)],
  (prop, value) => (prop === "font-family" ? [checkFontFamily(value)] : []),
  (prop, value) => (prop === "font-size" ? [checkFontSize(value)] : []),
  (prop, value) => (prop === "box-shadow" ? [checkShadow(value)] : []),
  (prop, value) => (prop === "line-height" ? [checkLineHeight(value)] : []),
  (prop, value) => (prop === "opacity" ? [checkOpacity(value)] : []),
  (prop, value) => (prop === "letter-spacing" ? [checkLetterSpacing(value)] : []),
];

/** Run all token checks against a single property declaration. */
function checkDeclaration(
  prop: string,
  value: string,
  line: string,
): Array<{ raw: string; suggestion: string }> {
  const results: Array<{ raw: string; suggestion: string }> = [];
  for (const checker of TOKEN_CHECKERS) {
    for (const result of checker(prop, value, line)) {
      if (result) results.push(result);
    }
  }
  return results;
}

function scanFile(filepath: string): Violation[] {
  const rel = relative(join(ROOT, ".."), filepath);
  if (rel.endsWith("print.css")) return [];

  const content = readFileSync(filepath, "utf-8");
  const lines = content.split("\n");
  const excludedLines = getExcludedLines(lines);
  const varBlockLines = getVarBlockLines(lines);
  const violations: Violation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] as string;
    const nextLine = lines[i + 1] as string | undefined;
    let line = rawLine;
    if (excludedLines.has(i) || varBlockLines.has(i) || isSkippableLine(line)) continue;

    const mqResult = checkMediaQuery(rawLine, nextLine);
    if (mqResult) {
      violations.push({ file: rel, line: i + 1, ...mqResult });
    }

    // Strip inline comments
    line = line.replace(/\/\*.*?\*\//g, "").replace(/\/\/.*$/, "");

    const propMatch = line.match(/^\s*([\w-]+)\s*:\s*(.+)/);
    if (!(propMatch?.[1] && propMatch[2])) continue;
    const prop = propMatch[1];
    const value = propMatch[2];

    for (const result of checkDeclaration(prop, value, line)) {
      violations.push({ file: rel, line: i + 1, ...result });
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
