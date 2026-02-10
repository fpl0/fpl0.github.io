/**
 * Lightweight fuzzy matching algorithm for search.
 * Returns score based on match quality; 0 if no match.
 *
 * Scoring:
 * - Exact substring match: 100 + length ratio bonus (up to 50)
 * - Fuzzy match: 10 per char + consecutive bonus (5 per streak)
 */
export function fuzzyMatch(query: string, text: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  // Exact substring match gets highest score
  if (lowerText.includes(lowerQuery)) {
    return 100 + (lowerQuery.length / lowerText.length) * 50;
  }

  // Fuzzy matching - all query chars must appear in order
  let queryIndex = 0;
  let score = 0;
  let consecutiveBonus = 0;

  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      score += 10 + consecutiveBonus;
      consecutiveBonus += 5;
      queryIndex++;
    } else {
      consecutiveBonus = 0;
    }
  }

  return queryIndex === lowerQuery.length ? score : 0;
}
