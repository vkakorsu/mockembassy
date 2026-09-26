import type { VisaType } from "./case";
import { probesFor } from "./probes";
import { similarity } from "./similarity";

/**
 * Questions applicants say they were actually asked at the embassy (reported
 * with their outcome, with consent). Each is matched to the closest standard
 * topic, so the Director can ask the topics Accra officers really ask more
 * often. Only used for weighting: reported text never reaches the officer.
 */

const MATCH_THRESHOLD = 0.3;

/** The standard topic a reported question is about, or null. */
export function matchReportedQuestion(question: string, visaType: VisaType): string | null {
  const q = question.trim();
  if (q.length < 6 || q.length > 200) return null;
  let best: { id: string; s: number } | null = null;
  for (const p of probesFor(visaType)) {
    for (const t of p.entry) {
      const s = similarity(q, t.replace(/\{\w+\}/g, ""));
      if (!best || s > best.s) best = { id: p.id, s };
    }
  }
  return best && best.s >= MATCH_THRESHOLD ? best.id : null;
}

/** Share of matched reports per topic (0..1, summing to 1 across topics). */
export function reportedTopicShares(questions: readonly string[], visaType: VisaType): Record<string, number> {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const q of questions) {
    const id = matchReportedQuestion(q, visaType);
    if (!id) continue;
    counts[id] = (counts[id] ?? 0) + 1;
    total++;
  }
  const shares: Record<string, number> = {};
  for (const [id, n] of Object.entries(counts)) shares[id] = n / total;
  return shares;
}
