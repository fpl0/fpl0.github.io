/**
 * Unpublish a content entry (blog post or app).
 *
 * Usage:
 *   bun run 0:unpublish <slug>
 *
 * Sets isDraft to true, then commits and pushes.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { findContentFile, git, printAvailableSlugs, relativePath } from "./base";

// ---------------------------------------------------------------------------
// Frontmatter mutation
// ---------------------------------------------------------------------------

function unpublish(filePath: string): {
  title: string;
  alreadyDraft: boolean;
} {
  const raw = readFileSync(filePath, "utf-8");
  const match = raw.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!match) {
    console.error("Could not parse frontmatter.");
    process.exit(1);
  }

  const [, open, yaml, close] = match;
  const rest = raw.slice(match[0].length);

  const titleMatch = yaml.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  const title = titleMatch ? titleMatch[1] : "unknown";

  const draftMatch = yaml.match(/^isDraft:\s*(true|false)\s*$/m);
  if (draftMatch && draftMatch[1] === "true") {
    return { title, alreadyDraft: true };
  }

  let updated = yaml;

  if (draftMatch) {
    updated = updated.replace(/^isDraft:\s*false\s*$/m, "isDraft: true");
  } else {
    updated += "\nisDraft: true";
  }

  writeFileSync(filePath, `${open}${updated}${close}${rest}`);
  return { title, alreadyDraft: false };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const slug = process.argv[2];

if (!slug) {
  console.error("\nUsage: bun run 0:unpublish <slug>\n");
  printAvailableSlugs();
  process.exit(1);
}

const content = findContentFile(slug);
if (!content) {
  console.error(`\nNo content found for slug "${slug}".\n`);
  printAvailableSlugs();
  process.exit(1);
}

const { title, alreadyDraft } = unpublish(content.path);

if (alreadyDraft) {
  console.log(`\n"${title}" is already a draft.\n`);
  process.exit(0);
}

console.log(`\nUnpublished: ${title} (${content.type})`);

const rel = relativePath(content.path);
git(`git add ${rel}`);
git(`git commit -m "unpublish: ${title}"`);
git("git push");

console.log("\nCommitted and pushed.\n");
