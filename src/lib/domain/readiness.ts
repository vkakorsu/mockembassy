import type { CaseProfile } from "./case";
import type { PastSession } from "./director";
import { probesFor } from "./probes";

/**
 * How ready the applicant is, 0..1, across the topics their case will be
 * tested on. Credit per topic, from its latest answers:
 *   - weak or contradicted last time, or never asked: 0
 *   - answered well for one officer: 0.5
 *   - answered well for two or more different officers since the last weak answer: 1
 * Key topics count double. Surprise (wildcard) questions aren't included:
 * they're about composure, not preparation.
 */
export interface ReadinessTopic {
  id: string;
  critical: boolean;
}

export interface Readiness {
  score: number;
  /** Topics answered well at least once since their last weak answer. */
  answeredWell: number;
  /** Of those, confirmed by a second officer. */
  confirmed: number;
  total: number;
}

export function readiness(sessions: readonly PastSession[], topics: readonly ReadinessTopic[]): Readiness {
  if (!topics.length) return { score: 0, answeredWell: 0, confirmed: 0, total: 0 };
  // Officers who heard a good answer since the topic's last weak one (oldest session first).
  const good = new Map<string, Set<string>>();
  for (const s of [...sessions].reverse()) {
    for (const r of s.probeResults) {
      if (r.quality === "weak" || r.quality === "contradiction") good.set(r.probeId, new Set());
      else good.set(r.probeId, (good.get(r.probeId) ?? new Set<string>()).add(r.officerName));
    }
  }
  let earned = 0;
  let possible = 0;
  let answeredWell = 0;
  let confirmed = 0;
  for (const t of topics) {
    const weight = t.critical ? 2 : 1;
    const officers = good.get(t.id)?.size ?? 0;
    possible += weight;
    if (officers >= 1) answeredWell++;
    if (officers >= 2) confirmed++;
    earned += weight * (officers >= 2 ? 1 : officers === 1 ? 0.5 : 0);
  }
  return { score: earned / possible, answeredWell, confirmed, total: topics.length };
}

/** The topics this case will be tested on (surprise questions excluded). */
export function readinessTopics(profile: CaseProfile): ReadinessTopic[] {
  return probesFor(profile.visaType)
    .filter((p) => p.category !== "wildcard" && p.relevance(profile) > 0)
    .map((p) => ({ id: p.id, critical: p.critical }));
}
