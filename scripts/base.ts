/**
 * Shared utilities for content scripts.
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export const ROOT = join(import.meta.dirname, "..");
export const BLOG_DIR = join(ROOT, "src", "content", "blog");
export const APPS_DIR = join(ROOT, "src", "content", "apps");
export const APPS_PAGES = join(ROOT, "src", "pages", "apps");

// ---------------------------------------------------------------------------
// Prompt & string helpers
// ---------------------------------------------------------------------------

export function ask(question: string): string {
  const answer = prompt(question);
  return answer?.trim() ?? "";
}

export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

export function git(cmd: string): void {
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

export function relativePath(absPath: string): string {
  return absPath.replace(`${ROOT}/`, "");
}

// ---------------------------------------------------------------------------
// Content lookup
// ---------------------------------------------------------------------------

export interface ContentFile {
  type: "post" | "app";
  path: string;
}

/** Find the index file (md/mdx) for a given slug across blog and apps. */
export function findContentFile(slug: string): ContentFile | null {
  const blogDir = join(BLOG_DIR, slug);
  if (existsSync(blogDir) && statSync(blogDir).isDirectory()) {
    for (const ext of ["index.mdx", "index.md"]) {
      const p = join(blogDir, ext);
      if (existsSync(p)) return { type: "post", path: p };
    }
  }

  const appDir = join(APPS_DIR, slug);
  if (existsSync(appDir) && statSync(appDir).isDirectory()) {
    const p = join(appDir, "index.md");
    if (existsSync(p)) return { type: "app", path: p };
  }

  return null;
}

/** List all content slugs on disk. */
export function listSlugs(): string[] {
  const slugs: string[] = [];
  for (const dir of [BLOG_DIR, APPS_DIR]) {
    try {
      for (const name of readdirSync(dir)) {
        if (statSync(join(dir, name)).isDirectory()) {
          slugs.push(name);
        }
      }
    } catch {}
  }
  return slugs;
}

/** Print available slugs to stderr (for error messages). */
export function printAvailableSlugs(): void {
  const slugs = listSlugs();
  if (slugs.length > 0) {
    console.error("Available slugs:");
    for (const s of slugs) {
      console.error(`  ${s}`);
    }
    console.error("");
  }
}

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

export interface Frontmatter {
  title: string;
  isDraft: boolean;
  createdDate: string;
  publicationDate?: string;
}

/** Parse frontmatter from a markdown/mdx file. Returns null if unreadable. */
export function parseFrontmatter(filepath: string): Frontmatter | null {
  let raw: string;
  try {
    raw = readFileSync(filepath, "utf-8");
  } catch {
    return null;
  }

  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const yaml = match[1];
  const get = (key: string): string | undefined => {
    const re = new RegExp(`^${key}:\\s*(.+)$`, "m");
    const m = yaml.match(re);
    return m ? m[1].replace(/^["']|["']$/g, "").trim() : undefined;
  };

  const isDraftRaw = get("isDraft");
  const isDraft = isDraftRaw === undefined ? true : isDraftRaw === "true";

  return {
    title: get("title") ?? "(untitled)",
    isDraft,
    createdDate: get("createdDate") ?? "unknown",
    publicationDate: get("publicationDate"),
  };
}
