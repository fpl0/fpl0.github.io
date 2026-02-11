import type { CollectionEntry } from "astro:content";
import { getPublishedApps } from "./apps";
import { getPublishedPosts } from "./posts";

export type FeedItem =
  | { type: "post"; entry: CollectionEntry<"blog"> }
  | { type: "app"; entry: CollectionEntry<"apps"> };

/**
 * Fetch all published content (posts + apps) as a unified feed,
 * sorted by date descending with slug tiebreaker.
 */
export async function getFeedItems(): Promise<FeedItem[]> {
  const [posts, apps] = await Promise.all([getPublishedPosts(), getPublishedApps()]);

  const items: FeedItem[] = [
    ...posts.map((entry) => ({ type: "post" as const, entry })),
    ...apps.map((entry) => ({ type: "app" as const, entry })),
  ];

  return items.sort((a, b) => {
    const dateDiff = b.entry.data.date.valueOf() - a.entry.data.date.valueOf();
    return dateDiff !== 0 ? dateDiff : a.entry.slug.localeCompare(b.entry.slug);
  });
}
