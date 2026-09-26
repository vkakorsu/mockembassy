import type { CaseProfile } from "./case";
import type { AnswerQuality, PastSession, SessionMode } from "./director";
import { probesFor } from "./probes";

/**
 * How prepared the applicant is, 0..1. Not a chance of approval: it measures
 * whether they can answer what their case will be tested on, under realistic
 * pressure, lately. docs/INTERVIEW-REALISM.md §11 explains each choice.
 *
 * Per topic, a mastery estimate from every answer on it:
 *   - quality: the live officer's judgement, averaged with the independent
 *     debrief grade when there is one (the grader is steadier than the officer);
 *   - weighted by how realistic the setting was (dress rehearsal > interview >
 *     practice > drill), how tough the officer was, how recent it is (half-life
 *     three weeks), and discounted when crammed (the same topic again within
 *     30 minutes);
 *   - mastery = quality (latest answers count most) × confidence (how much
 *     recent, realistic evidence there is), capped after a weak latest answer,
 *     and capped until two different officers, one of them tough, heard it
 *     answered well.
 * Topics are weighted by how likely they are to come up and whether they
 * decide the case. The overall score is then capped until the applicant has
 * passed a full interview with a tough officer, answered every key topic
 * well, and kept their answers consistent with their file.
 */

export interface ReadinessTopic {
  id: string;
  critical: boolean;
  /** How much the topic counts: key topics double, rarely asked ones less. */
  weight: number;
}

export type TopicStatus = "untested" | "weak" | "improving" | "solid";

export interface TopicReadiness {
  id: string;
  critical: boolean;
  weight: number;
  /** 0..1 */
  mastery: number;
  status: TopicStatus;
  /** Different officers who heard it answered well since the last weak answer. */
  officers: number;
  /** One of them was tough (sceptical, or a dress rehearsal). */
  toughOfficer: boolean;
  lastAt?: string;
}

export interface ReadinessCap {
  id: "no_full_pass" | "key_topic_untested" | "inconsistency";
  max: number;
  reason: string;
}

export type ReadinessLevel = "not_started" | "building" | "getting_close" | "nearly_ready" | "well_prepared";

export interface Readiness {
  score: number;
  level: ReadinessLevel;
  /** Topics answered well at least once since their last weak answer. */
  answeredWell: number;
  /** Of those, confirmed by two officers, one of them tough. */
  confirmed: number;
  total: number;
  topics: TopicReadiness[];
  /** Limits holding the score down right now, lowest first. */
  caps: ReadinessCap[];
  /** Topics to work on next, most valuable first. */
  next: string[];
}

export const LEVEL_LABELS: Record<ReadinessLevel, string> = {
  not_started: "Not started",
  building: "Building",
  getting_close: "Getting close",
  nearly_ready: "Nearly ready",
  well_prepared: "Well prepared",
};

const QUALITY: Record<AnswerQuality, number> = { strong: 1, adequate: 0.6, weak: 0.15, contradiction: 0 };
const MODE_WEIGHT: Record<SessionMode, number> = { dress_rehearsal: 1.2, real: 1, practice: 0.8, drill: 0.6 };
/**
 * How much recent, realistic evidence makes a topic trustworthy: confidence is
 * 1 − e^(−evidence/SCALE), so one interview answer gives ~63%, two ~86%,
 * three ~95%. Old evidence fades with its weight.
 */
const CONFIDENCE_SCALE = 1;
/** Each later answer on a topic halves the say of the ones before it: people improve. */
const RECENCY_BY_ORDER = 0.5;
const HALF_LIFE_DAYS = 21;
const CRAM_WINDOW_MS = 30 * 60_000;
const GOOD = 0.6;
const BAD = 0.4;
const TOUGH_SCEPTICISM = 0.6;
const DAY = 24 * 60 * 60 * 1000;

const isTough = (s: PastSession) => s.mode === "dress_rehearsal" || s.officer.traits.scepticism >= TOUGH_SCEPTICISM;

interface Evidence {
  q: number;
  w: number;
  officer: string;
  tough: boolean;
  at?: string;
}

/** One judgement per topic per session: the officer's final view (a contradiction sticks), blended with the debrief grade. */
function sessionEvidence(s: PastSession, topicId: string): number | null {
  const results = s.probeResults.filter((r) => r.probeId === topicId);
  if (!results.length) return null;
  const officerQ = results.some((r) => r.quality === "contradiction") ? 0 : QUALITY[results[results.length - 1].quality];
  const grades = (s.grades ?? []).filter((g) => g.probeId === topicId).map((g) => g.score);
  if (!grades.length || officerQ === 0) return officerQ;
  return (officerQ + grades.reduce((a, b) => a + b, 0) / grades.length) / 2;
}

function topicReadiness(topic: ReadinessTopic, oldestFirst: readonly PastSession[], now: number): TopicReadiness {
  const evidence: Evidence[] = [];
  let lastCountedAt: number | null = null;
  for (const s of oldestFirst) {
    const q = sessionEvidence(s, topic.id);
    if (q === null) continue;
    const at = s.at ? Date.parse(s.at) : NaN;
    const age = Number.isFinite(at) ? Math.max(0, (now - at) / DAY) : 0;
    let w = MODE_WEIGHT[s.mode ?? "real"] * (0.75 + 0.5 * s.officer.traits.scepticism) * 0.5 ** (age / HALF_LIFE_DAYS);
    // Answering the same thing again minutes later shows short-term memory, not readiness.
    if (Number.isFinite(at) && lastCountedAt !== null && at - lastCountedAt < CRAM_WINDOW_MS) w *= 0.5;
    if (Number.isFinite(at)) lastCountedAt = at;
    evidence.push({ q, w, officer: s.officer.name, tough: isTough(s), at: s.at });
  }
  if (!evidence.length) {
    return { ...topic, mastery: 0, status: "untested", officers: 0, toughOfficer: false };
  }

  // How good the answers are now (latest answers count most) × how sure we are (amount of recent evidence).
  const ordered = evidence.map((e, i) => e.w * RECENCY_BY_ORDER ** (evidence.length - 1 - i));
  const quality = evidence.reduce((a, e, i) => a + ordered[i] * e.q, 0) / ordered.reduce((a, w) => a + w, 0);
  const confidence = 1 - Math.exp(-evidence.reduce((a, e) => a + e.w, 0) / CONFIDENCE_SCALE);
  let mastery = quality * confidence;
  const last = evidence[evidence.length - 1];
  // Good answers since the last weak one, from how many officers, and was one tough?
  const sinceBad = evidence.slice(evidence.map((e) => e.q < BAD).lastIndexOf(true) + 1).filter((e) => e.q >= GOOD);
  const officers = new Set(sinceBad.map((e) => e.officer)).size;
  const toughOfficer = sinceBad.some((e) => e.tough);
  const confirmed = officers >= 2 && toughOfficer;

  if (last.q < BAD) mastery = Math.min(mastery, 0.3);
  else if (!confirmed) mastery = Math.min(mastery, 0.7);

  const status: TopicStatus = last.q < BAD ? "weak" : confirmed && mastery >= GOOD ? "solid" : "improving";
  return { ...topic, mastery, status, officers, toughOfficer, lastAt: last.at };
}

export function readiness(sessions: readonly PastSession[], topics: readonly ReadinessTopic[], now = Date.now()): Readiness {
  const oldestFirst = [...sessions].reverse();
  const perTopic = topics.map((t) => topicReadiness(t, oldestFirst, now));
  const totalWeight = perTopic.reduce((a, t) => a + t.weight, 0);
  const answers = totalWeight ? perTopic.reduce((a, t) => a + t.weight * t.mastery, 0) / totalWeight : 0;

  const caps: ReadinessCap[] = [];
  const untestedKey = perTopic.filter((t) => t.critical && (t.status === "untested" || t.status === "weak"));
  if (untestedKey.length) {
    caps.push({
      id: "key_topic_untested",
      max: 0.75,
      reason: `${untestedKey.length === 1 ? "A key topic hasn't" : `${untestedKey.length} key topics haven't`} been answered well yet.`,
    });
  }
  // A full interview, passed, with a tough officer, in the last three weeks.
  const passed = sessions.some(
    (s) =>
      (s.mode === "real" || s.mode === "dress_rehearsal") &&
      s.outcome === "approved" &&
      isTough(s) &&
      (!s.at || now - Date.parse(s.at) <= HALF_LIFE_DAYS * DAY),
  );
  if (!passed) {
    caps.push({ id: "no_full_pass", max: 0.9, reason: "Pass a full interview or dress rehearsal with a tough officer to go above 90%." });
  }
  // The latest full interview: a contradiction with the file is the fastest way to a refusal.
  const lastFull = sessions.find((s) => s.mode !== "drill");
  if (lastFull?.hadInconsistency) {
    caps.push({ id: "inconsistency", max: 0.6, reason: "In your last interview an answer contradicted your file. Pass one without that." });
  }
  caps.sort((a, b) => a.max - b.max);

  const score = Math.max(0, Math.min(answers, ...caps.map((c) => c.max), 1));
  const next = [...perTopic]
    .filter((t) => t.status !== "solid")
    // The most to gain first; weak answers before untested ones at equal value.
    .sort((a, b) => b.weight * (1 - b.mastery) + (b.status === "weak" ? 0.5 : 0) - (a.weight * (1 - a.mastery) + (a.status === "weak" ? 0.5 : 0)))
    .map((t) => t.id);

  return {
    score,
    level: levelFor(score, perTopic),
    answeredWell: perTopic.filter((t) => t.status === "improving" || t.status === "solid").filter((t) => t.officers > 0).length,
    confirmed: perTopic.filter((t) => t.status === "solid").length,
    total: perTopic.length,
    topics: perTopic,
    caps,
    next,
  };
}

function levelFor(score: number, topics: readonly TopicReadiness[]): ReadinessLevel {
  if (topics.every((t) => t.status === "untested")) return "not_started";
  // From the percentage shown, so "90%" never reads "Nearly ready".
  const pct = Math.round(score * 100);
  if (pct >= 90) return "well_prepared";
  if (pct >= 75) return "nearly_ready";
  if (pct >= 45) return "getting_close";
  return "building";
}

/**
 * The topics this case will be tested on (surprise questions excluded: they're
 * about composure, not preparation), weighted by how likely they are to come
 * up and whether they decide the case.
 */
export function readinessTopics(profile: CaseProfile): ReadinessTopic[] {
  return probesFor(profile.visaType)
    .filter((p) => p.category !== "wildcard" && p.relevance(profile) > 0)
    // Key topics decide the case; others count by how likely they are to be asked (squared, so rare ones count little).
    .map((p) => ({ id: p.id, critical: p.critical, weight: p.critical ? 2 : Math.min(1, p.relevance(profile)) ** 2 }));
}
