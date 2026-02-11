import { type CollectionEntry, getCollection } from "astro:content";

/**
 * Fetch all published (non-draft) apps, sorted by date descending.
 * Uses slug as a tiebreaker for deterministic ordering when dates match.
 */
export async function getPublishedApps(): Promise<CollectionEntry<"apps">[]> {
  const apps = await getCollection("apps", ({ data }) => !data.isDraft);
  return apps.sort((a, b) => {
    const dateDiff = b.data.date.valueOf() - a.data.date.valueOf();
    return dateDiff !== 0 ? dateDiff : a.slug.localeCompare(b.slug);
  });
}
