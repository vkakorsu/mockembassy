/**
 * Cheap lexical similarity used by the novelty check. In production the same
 * interface is backed by pgvector embeddings; this keeps tests hermetic and
 * acts as a fallback when the embedding call fails.
 */

function trigrams(text: string): Set<string> {
  const s = ` ${text.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim()} `;
  const out = new Set<string>();
  for (let i = 0; i < s.length - 2; i++) out.add(s.slice(i, i + 3));
  return out;
}

export function similarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

export function maxSimilarity(text: string, against: readonly string[]): number {
  let max = 0;
  for (const other of against) max = Math.max(max, similarity(text, other));
  return max;
}
