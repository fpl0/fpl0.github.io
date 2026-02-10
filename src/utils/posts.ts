import { type CollectionEntry, getCollection } from "astro:content";

/**
 * Fetch all published (non-draft) blog posts, sorted by date descending.
 * Uses slug as a tiebreaker for deterministic ordering when dates match.
 */
export async function getPublishedPosts(): Promise<CollectionEntry<"blog">[]> {
  const posts = await getCollection("blog", ({ data }) => !data.isDraft);
  return posts.sort((a, b) => {
    const dateDiff = b.data.date.valueOf() - a.data.date.valueOf();
    return dateDiff !== 0 ? dateDiff : a.slug.localeCompare(b.slug);
  });
}
