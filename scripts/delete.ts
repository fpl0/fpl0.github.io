/**
 * Delete a content entry (blog post or app).
 *
 * Usage:
 *   bun run 0:delete <slug>
 *
 * Removes all files for the given slug, then commits and pushes.
 */

import { existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { APPS_DIR, APPS_PAGES, BLOG_DIR, git, printAvailableSlugs, relativePath } from "./base";

// ---------------------------------------------------------------------------
// Find all paths to delete for a slug
// ---------------------------------------------------------------------------

interface DeleteTarget {
  type: "post" | "app";
  paths: string[];
}

function findTarget(slug: string): DeleteTarget | null {
  const blogDir = join(BLOG_DIR, slug);
  if (existsSync(blogDir) && statSync(blogDir).isDirectory()) {
    return { type: "post", paths: [blogDir] };
  }

  const appDir = join(APPS_DIR, slug);
  if (existsSync(appDir) && statSync(appDir).isDirectory()) {
    const paths = [appDir];
    const pageFile = join(APPS_PAGES, `${slug}.astro`);
    if (existsSync(pageFile)) paths.push(pageFile);
    return { type: "app", paths };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const slug = process.argv[2];

if (!slug) {
  console.error("\nUsage: bun run 0:delete <slug>\n");
  printAvailableSlugs();
  process.exit(1);
}

const target = findTarget(slug);
if (!target) {
  console.error(`\nNo content found for slug "${slug}".\n`);
  printAvailableSlugs();
  process.exit(1);
}

const relativePaths = target.paths.map(relativePath);
console.log(`\nThis will delete the following (${target.type}):\n`);
for (const p of relativePaths) {
  console.log(`  ${p}`);
}

const answer = prompt("\nProceed? (y/N):");
if (answer?.toLowerCase() !== "y") {
  console.log("Aborted.\n");
  process.exit(0);
}

for (const p of target.paths) {
  rmSync(p, { recursive: true });
}

console.log("\nDeleted.");

for (const p of relativePaths) {
  git(`git add ${p}`);
}
git(`git commit -m "delete: ${slug}"`);
git("git push");

console.log("Committed and pushed.\n");
