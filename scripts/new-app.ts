/**
 * Scaffold a new app.
 *
 * Usage:
 *   bun run 0:new:app
 *
 * Creates:
 *   - src/content/apps/<slug>/index.md
 *   - src/content/apps/<slug>/App.astro
 *   - src/pages/apps/<slug>.astro
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { APPS_DIR, APPS_PAGES, ask, todayISO, toSlug } from "./base";

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function indexMd(title: string, summary: string, tags: string[], date: string): string {
  const tagList = tags.length > 0 ? `[${tags.map((t) => `"${t}"`).join(", ")}]` : "[]";
  return `---
title: "${title}"
summary: "${summary}"
createdDate: ${date}
isDraft: true
tags: ${tagList}
---
`;
}

function appAstro(slug: string): string {
  return `---
/**
 * ${slug} -- App Component
 *
 * Self-contained UI and all client-side logic.
 * Imported by the thin page stub at src/pages/apps/${slug}.astro.
 */
---

<div class="${slug}-root" id="${slug}-root">
  <p class="${slug}-placeholder">App goes here.</p>
</div>

<style>
  .${slug}-root {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: var(--color-text);
  }

  .${slug}-placeholder {
    font-family: var(--font-serif);
    font-size: var(--font-size-h3);
    color: var(--color-text-muted);
  }
</style>

<script>
  import { onPageReady } from "../../../utils/lifecycle";

  onPageReady((signal) => {
    const root = document.getElementById("${slug}-root");
    if (!root) return;

    // Handle theme changes — redraw when theme toggles
    const themeObserver = new MutationObserver(() => {
      // Re-render if needed
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    signal.addEventListener("abort", () => themeObserver.disconnect());
  });
${"</"}script>
`;
}

function pageStub(slug: string, title: string, description: string): string {
  return `---
import App from "../../content/apps/${slug}/App.astro";
import AppShell from "../../layouts/AppShell.astro";
---

<AppShell
  title="${title}"
  description="${description}"
>
  <App />
</AppShell>
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("\n--- New App Scaffolding ---\n");

const title = ask("Title:");
if (!title) {
  console.error("Title is required.");
  process.exit(1);
}

const defaultSlug = toSlug(title);
const slugInput = ask(`Slug [${defaultSlug}]:`);
const slug = slugInput || defaultSlug;

const appDir = join(APPS_DIR, slug);
const pageFile = join(APPS_PAGES, `${slug}.astro`);
if (existsSync(appDir) || existsSync(pageFile)) {
  console.error(`App "${slug}" already exists.`);
  process.exit(1);
}

let summary = "";
while (true) {
  summary = ask("Summary (50-360 chars):");
  if (summary.length >= 50 && summary.length <= 360) break;
  console.log(`  Got ${summary.length} chars -- must be between 50 and 360.`);
}

const tagsInput = ask("Tags (comma-separated, or empty):");
const tags = tagsInput
  ? tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
  : [];

const date = todayISO();
mkdirSync(appDir, { recursive: true });
writeFileSync(join(appDir, "index.md"), indexMd(title, summary, tags, date));
writeFileSync(join(appDir, "App.astro"), appAstro(slug));
writeFileSync(pageFile, pageStub(slug, title, summary));

console.log("\nCreated:");
console.log(`  src/content/apps/${slug}/index.md`);
console.log(`  src/content/apps/${slug}/App.astro`);
console.log(`  src/pages/apps/${slug}.astro`);
console.log(`\nThe app is unpublished (isDraft: true). Edit App.astro to build it out.\n`);
