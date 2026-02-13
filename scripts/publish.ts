/**
 * Publish a content entry (blog post or app).
 *
 * Usage:
 *   bun run publish <slug>
 *
 * Sets isDraft to false, sets publicationDate to today (if not already set),
 * then commits and pushes.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { findContentFile, git, printAvailableSlugs, relativePath, todayISO } from "./base";

// ---------------------------------------------------------------------------
// Frontmatter mutation
// ---------------------------------------------------------------------------

function publish(filePath: string): {
  title: string;
  alreadyPublished: boolean;
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
  if (draftMatch && draftMatch[1] === "false") {
    return { title, alreadyPublished: true };
  }

  let updated = yaml;

  if (draftMatch) {
    updated = updated.replace(/^isDraft:\s*true\s*$/m, "isDraft: false");
  } else {
    updated += "\nisDraft: false";
  }

  const hasPubDate = /^publicationDate:/m.test(updated);
  if (!hasPubDate) {
    if (/^createdDate:.*$/m.test(updated)) {
      updated = updated.replace(/^(createdDate:.*$)/m, `$1\npublicationDate: "${todayISO()}"`);
    } else {
      updated += `\npublicationDate: "${todayISO()}"`;
    }
  }

  writeFileSync(filePath, `${open}${updated}${close}${rest}`);
  return { title, alreadyPublished: false };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const slug = process.argv[2];

if (!slug) {
  console.error("\nUsage: bun run publish <slug>\n");
  printAvailableSlugs();
  process.exit(1);
}

const content = findContentFile(slug);
if (!content) {
  console.error(`\nNo content found for slug "${slug}".\n`);
  printAvailableSlugs();
  process.exit(1);
}

const { title, alreadyPublished } = publish(content.path);

if (alreadyPublished) {
  console.log(`\n"${title}" is already published.\n`);
  process.exit(0);
}

console.log(`\nPublished: ${title} (${content.type})`);

const rel = relativePath(content.path);
git(`git add ${rel}`);
git(`git commit -m "publish: ${title}"`);
git("git push");

console.log("\nCommitted and pushed.\n");
