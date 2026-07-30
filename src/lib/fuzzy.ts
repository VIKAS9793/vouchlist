/**
 * Tiny, dependency free typo tolerant matcher.
 *
 * Scoring is deliberately simple so it stays fast enough to run on every
 * keystroke against the whole in memory index (no network round trip):
 *   1. exact substring match, boosted when it starts a word
 *   2. prefix match
 *   3. bounded Levenshtein distance per word (handles typos and swaps)
 *   4. subsequence fallback (handles skipped letters)
 */

/** Levenshtein distance, abandoned early once it passes `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      row[j] = value;
      if (value < best) best = value;
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

/** True when every character of `needle` appears in order inside `haystack`. */
function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i++;
  }
  return i === needle.length;
}

/** Typo budget scales with term length so short terms stay strict. */
function budgetFor(length: number): number {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  return 2;
}

/**
 * Scores one query term against a lowercase haystack. Returns 0 when there is
 * no usable match, otherwise a positive score where higher is better.
 */
export function scoreTerm(term: string, haystack: string): number {
  if (!term) return 0;
  const index = haystack.indexOf(term);
  if (index === 0) return 100;
  if (index > 0) return haystack[index - 1] === " " ? 90 : 70;

  const words = haystack.split(/[^a-z0-9]+/).filter(Boolean);
  const budget = budgetFor(term.length);
  let best = 0;

  for (const word of words) {
    if (word.startsWith(term)) {
      best = Math.max(best, 85);
      continue;
    }
    if (budget > 0) {
      if (editDistance(term, word, budget) <= budget) {
        best = Math.max(best, 60);
      } else if (word.length > term.length) {
        const prefix = word.slice(0, term.length);
        if (editDistance(term, prefix, budget) <= budget) best = Math.max(best, 50);
      }
    }
  }

  if (best === 0 && term.length >= 4 && isSubsequence(term, haystack)) best = 25;
  return best;
}

/**
 * Scores a full query against a weighted document. Every term must match
 * something, so extra words narrow results instead of widening them.
 */
export function scoreDocument(query: string, fields: { text: string; weight: number }[]): number {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 0;

  let total = 0;
  for (const term of terms) {
    let bestForTerm = 0;
    for (const field of fields) {
      const score = scoreTerm(term, field.text);
      if (score > 0) bestForTerm = Math.max(bestForTerm, score * field.weight);
    }
    if (bestForTerm === 0) return 0;
    total += bestForTerm;
  }
  return total / terms.length;
}
