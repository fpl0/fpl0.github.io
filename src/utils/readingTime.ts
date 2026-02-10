/**
 * Calculate estimated reading time for markdown content
 * Based on average reading speed of 200 words per minute
 */

const WORDS_PER_MINUTE = 200;

/**
 * Strips markdown syntax and returns estimated reading time
 * @param content - Raw markdown content
 * @returns Formatted reading time string (e.g., "5 min read")
 */
export function getReadingTime(content: string): string {
  if (!content) return "";

  const cleanText = content
    .replace(/!\[.*?\]\(.*?\)/g, "") // Remove images
    .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Remove link syntax, keep text
    .replace(/#{1,6}\s/g, "") // Remove heading markers
    .replace(/[`*_~]/g, "") // Remove inline formatting
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/<[^>]+>/g, "") // Remove HTML tags
    .trim();

  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));

  return `${minutes} min read`;
}
