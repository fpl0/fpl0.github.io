/**
 * List all content (blog posts and apps).
 *
 * Usage:
 *   bun run list              — show all content
 *   bun run list -- --drafts  — only drafts
 *   bun run list -- --published — only published
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { APPS_DIR, BLOG_DIR, type Frontmatter, parseFrontmatter } from "./base";

// ---------------------------------------------------------------------------
// Collect entries
// ---------------------------------------------------------------------------

interface Entry {
  type: "post" | "app";
  slug: string;
  frontmatter: Frontmatter;
}

function collectEntries(dir: string, type: "post" | "app"): Entry[] {
  let slugs: string[];
  try {
    slugs = readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory());
  } catch {
    return [];
  }

  const entries: Entry[] = [];
  for (const slug of slugs) {
    const fm =
      parseFrontmatter(join(dir, slug, "index.mdx")) ??
      parseFrontmatter(join(dir, slug, "index.md"));
    if (fm) entries.push({ type, slug, frontmatter: fm });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

function pad(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

function formatDate(dateStr: string): string {
  return dateStr.replace(/T.*$/, "");
}

interface Row {
  status: string;
  type: string;
  date: string;
  title: string;
  slug: string;
}

function toRow(entry: Entry): Row {
  const fm = entry.frontmatter;
  return {
    status: fm.isDraft ? "draft" : "published",
    type: entry.type,
    date: fm.publicationDate ? formatDate(fm.publicationDate) : formatDate(fm.createdDate),
    title: fm.title,
    slug: entry.slug,
  };
}

function printTable(rows: Row[]): void {
  const slugW = Math.max(4, ...rows.map((r) => r.slug.length));

  const header = `  ${pad("status", 9)}  ${pad("type", 4)}  ${"date"}        ${pad("slug", slugW)}  title`;
  const sep = `  ${"─".repeat(header.length - 2)}`;

  console.log("");
  console.log(header);
  console.log(sep);

  for (const r of rows) {
    console.log(
      `  ${pad(r.status, 9)}  ${pad(r.type, 4)}  ${pad(r.date, 10)}  ${pad(r.slug, slugW)}  ${r.title}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const filterDrafts = args.includes("--drafts");
const filterPublished = args.includes("--published");

let entries: Entry[] = [...collectEntries(BLOG_DIR, "post"), ...collectEntries(APPS_DIR, "app")];

if (filterDrafts) {
  entries = entries.filter((e) => e.frontmatter.isDraft);
} else if (filterPublished) {
  entries = entries.filter((e) => !e.frontmatter.isDraft);
}

entries.sort((a, b) => {
  const dateA = a.frontmatter.publicationDate ?? a.frontmatter.createdDate;
  const dateB = b.frontmatter.publicationDate ?? b.frontmatter.createdDate;
  return dateB.localeCompare(dateA);
});

if (entries.length === 0) {
  console.log("\n  No content found.\n");
} else {
  printTable(entries.map(toRow));
  console.log(`\n  ${entries.length} item${entries.length !== 1 ? "s" : ""}\n`);
}
