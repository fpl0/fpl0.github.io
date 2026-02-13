/**
 * Scaffold a new blog post.
 *
 * Usage:
 *   bun run new:post
 *
 * Creates:
 *   - src/content/blog/<slug>/index.mdx
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ask, BLOG_DIR, todayISO, toSlug } from "./base";

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

function indexMdx(title: string, summary: string, tags: string[], date: string): string {
  const tagList = tags.length > 0 ? `[${tags.map((t) => `"${t}"`).join(", ")}]` : "[]";
  return `---
title: "${title}"
summary: "${summary}"
createdDate: "${date}"
isDraft: true
tags: ${tagList}
---
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("\n--- New Blog Post Scaffolding ---\n");

const title = ask("Title:");
if (!title) {
  console.error("Title is required.");
  process.exit(1);
}

const defaultSlug = toSlug(title);
const slugInput = ask(`Slug [${defaultSlug}]:`);
const slug = slugInput || defaultSlug;

const postDir = join(BLOG_DIR, slug);
if (existsSync(postDir)) {
  console.error(`Post "${slug}" already exists.`);
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
mkdirSync(postDir, { recursive: true });
writeFileSync(join(postDir, "index.mdx"), indexMdx(title, summary, tags, date));

console.log("\nCreated:");
console.log(`  src/content/blog/${slug}/index.mdx`);
console.log(`\nThe post is unpublished (isDraft: true). Write your content in index.mdx.\n`);
