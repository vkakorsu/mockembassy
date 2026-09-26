import { z } from "zod";
import type { CaseProfile } from "./case";
import { scanCase } from "./case-scan";
import { documentLabel, isOnScreen, type CaseNote } from "./notes";
import { sampleOfficer, type Officer } from "./officer";
import { fillTemplate, isFillable, probesFor, type Probe } from "./probes";
import { between, createRng, pick, type Rng } from "./random";
import { maxSimilarity } from "./similarity";

/**
 * The Director plans one session for one user. It has memory of every past
 * session; the Officer that performs the plan does not. See docs/PLAN.md §2.2.
 *
 * This deterministic planner decides *what* is tested, by whom, for how long.
 * An LLM pass may later rephrase entries, but never changes probe selection.
 */

export type AnswerQuality = "strong" | "adequate" | "weak" | "contradiction";
export type SessionMode = "real" | "practice" | "dress_rehearsal" | "drill";

export interface ProbeResult {
  probeId: string;
  quality: AnswerQuality;
  officerName: string;
}

export interface PastSession {
  officer: Officer;
  probeResults: ProbeResult[];
  askedQuestions: string[];
}

export interface DirectorInput {
  profile: CaseProfile;
  /** Most recent first. */
  pastSessions: readonly PastSession[];
  /** 0..1 */
  readiness: number;
  mode: SessionMode;
  seed: string;
  /** Probes a human expert marked "needs work" (docs/EXPERTS.md). */
  expertFlaggedProbes?: readonly string[];
  /** Case notes the applicant confirmed (src/lib/domain/notes.ts). */
  notes?: readonly CaseNote[];
  /** Kinds of document the applicant uploaded: their folder at the window. */
  folder?: readonly string[];
}

export const REALISM_EVENTS = [
  "ask_to_repeat",
  "typing_silence",
  "document_request",
  "interrupt_mid_answer",
  "follow_volunteered",
  "ds160_cross_check",
] as const;

export const SessionPlanSchema = z.object({
  seed: z.string(),
  mode: z.enum(["real", "practice", "dress_rehearsal", "drill"]),
  officer: z.object({
    name: z.string(),
    voice: z.string(),
    traits: z.object({
      pace: z.number(),
      warmth: z.number(),
      scepticism: z.number(),
      patience: z.number(),
      silence: z.number(),
    }),
  }),
  probes: z
    .array(
      z.object({
        probeId: z.string(),
        critical: z.boolean(),
        entry: z.string(),
        followUpVague: z.array(z.string()),
        followUpContradiction: z.array(z.string()),
        mustInclude: z.array(z.string()),
        reason: z.enum(["untested", "weak_retest", "improving", "case_flag", "expert_flag", "coverage", "wildcard"]),
      }),
    )
    .min(1)
    .max(5),
  targetDurationSec: z.number().int().min(45).max(360),
  earlyDecisionAllowed: z.boolean(),
  visaType: z.enum(["F1", "B1B2"]).optional(),
  events: z.array(z.enum(REALISM_EVENTS)).max(2),
  noveltyRate: z.number().min(0).max(1),
  /** Confirmed case notes, snapshotted at planning time. */
  notes: z
    .array(z.object({ id: z.string(), text: z.string(), source: z.string(), onScreen: z.boolean() }))
    .max(30)
    .optional(),
  /** Document kinds in the applicant's folder. */
  folder: z.array(z.string()).max(20).optional(),
});

export type SessionPlan = z.infer<typeof SessionPlanSchema>;
type PlannedProbe = SessionPlan["probes"][number];

export type ProbeStatus = "untested" | "weak" | "improving" | "solid";

/** A weakness counts as fixed only after ≥2 distinct officers saw it answered well. */
export function probeStatus(probeId: string, sessions: readonly PastSession[]): ProbeStatus {
  // sessions are most-recent first; walk oldest -> newest
  const results = sessions
    .slice()
    .reverse()
    .flatMap((s) => s.probeResults.filter((r) => r.probeId === probeId));
  if (results.length === 0) return "untested";
  const last = results[results.length - 1];
  if (last.quality === "weak" || last.quality === "contradiction") return "weak";
  let lastBad = -1;
  results.forEach((r, i) => {
    if (r.quality === "weak" || r.quality === "contradiction") lastBad = i;
  });
  const goodOfficers = new Set(results.slice(lastBad + 1).map((r) => r.officerName));
  return goodOfficers.size >= 2 ? "solid" : "improving";
}

const NOVELTY_THRESHOLD = 0.6;

function chooseEntry(rng: Rng, probe: Probe, profile: CaseProfile, recentQuestions: readonly string[]) {
  const options = probe.entry.filter((t) => isFillable(t, profile)).map((t) => fillTemplate(t, profile));
  const fresh = options.filter((q) => maxSimilarity(q, recentQuestions) < NOVELTY_THRESHOLD);
  if (fresh.length) return { text: pick(rng, fresh), novel: true };
  // Everything was asked recently: take the least similar phrasing.
  const sorted = options
    .map((q) => ({ q, s: maxSimilarity(q, recentQuestions) }))
    .sort((a, b) => a.s - b.s);
  return { text: sorted[0].q, novel: false };
}

export function planSession(input: DirectorInput): SessionPlan {
  const { profile, pastSessions, mode } = input;
  const rng = createRng(input.seed);
  const recent = pastSessions.slice(0, 3);
  const recentQuestions = recent.flatMap((s) => s.askedQuestions);
  const lastSessionProbes = new Set(pastSessions[0]?.probeResults.map((r) => r.probeId) ?? []);
  const flagged = new Set(scanCase(profile).flatMap((f) => f.probes));
  const expert = new Set(input.expertFlaggedProbes ?? []);

  const candidates = probesFor(profile.visaType).filter(
    (p) => p.relevance(profile) > 0 && p.entry.some((t) => isFillable(t, profile)),
  );
  const core = candidates.filter((p) => p.category !== "wildcard");
  const wildcards = candidates.filter((p) => p.category === "wildcard");

  const scored = core.map((p): { probe: Probe; score: number; reason: PlannedProbe["reason"] } => {
    const status = probeStatus(p.id, pastSessions);
    let score = p.relevance(profile) + (p.critical ? 0.3 : 0) + rng() * 0.6;
    let reason: PlannedProbe["reason"] = "coverage";
    if (status === "untested") {
      score += 0.8;
      reason = "untested";
    }
    if (status === "improving") {
      score += 0.6;
      reason = "improving";
    }
    if (flagged.has(p.id)) {
      score += 0.5;
      if (reason === "coverage") reason = "case_flag";
    }
    if (status === "weak") {
      score += 1.4;
      reason = "weak_retest";
    }
    if (expert.has(p.id)) {
      score += 1.2;
      reason = "expert_flag";
    }
    if (status === "solid" && lastSessionProbes.has(p.id)) score -= 1.0;
    return { probe: p, score, reason };
  });
  scored.sort((a, b) => b.score - a.score);

  const [minCount, maxCount] = mode === "dress_rehearsal" ? [3, 4] : [2, 4];
  const count = Math.min(scored.length, Math.round(between(rng, minCount, maxCount)));
  const chosen = scored.slice(0, count);

  // Always test at least one critical probe.
  if (!chosen.some((c) => c.probe.critical)) {
    const critical = scored.find((c) => c.probe.critical);
    if (critical) chosen[chosen.length - 1] = critical;
  }

  // Real officers usually open on purpose; sometimes they go straight to money.
  const purposeIdx = chosen.findIndex((c) => c.probe.category === "purpose");
  if (purposeIdx > 0 && rng() < 0.7) {
    const [p] = chosen.splice(purposeIdx, 1);
    chosen.unshift(p);
  }

  const wildcardChance = mode === "dress_rehearsal" ? 0.5 : mode === "real" ? 0.35 : 0.2;
  if (wildcards.length && rng() < wildcardChance) {
    chosen.push({ probe: pick(rng, wildcards), score: 0, reason: "wildcard" });
  }

  let novel = 0;
  const probes: PlannedProbe[] = chosen.map(({ probe, reason }) => {
    const entry = chooseEntry(rng, probe, profile, recentQuestions);
    if (entry.novel) novel++;
    const fill = (list: readonly string[]) =>
      list.filter((t) => isFillable(t, profile)).map((t) => fillTemplate(t, profile));
    return {
      probeId: probe.id,
      critical: probe.critical,
      entry: entry.text,
      followUpVague: fill(probe.followUpVague),
      followUpContradiction: fill(probe.followUpContradiction),
      mustInclude: probe.mustInclude(profile),
      reason,
    };
  });

  // A question only this applicant would get: one confirmed note from their own
  // documents, not asked about in the last two sessions.
  const notePick = pickNoteProbe(rng, input.notes ?? [], pastSessions, mode);
  if (notePick) {
    // Never the opener; if the plan is full, it replaces the last optional topic.
    if (probes.length >= 5) {
      const i = probes.map((p) => !p.critical && p.reason !== "weak_retest").lastIndexOf(true);
      probes.splice(i >= 0 ? i : probes.length - 1, 1);
    }
    probes.splice(Math.min(probes.length, 1 + Math.floor(rng() * Math.max(1, probes.length - 1))), 0, notePick);
  }

  const officer = sampleOfficer(rng, {
    readiness: mode === "dress_rehearsal" ? Math.max(input.readiness, 0.6) : input.readiness,
    recent: recent.map((s) => s.officer),
  });

  const [minDur, maxDur] =
    mode === "practice" ? [180, 300] : mode === "dress_rehearsal" ? [120, 210] : [60, 240];

  const eventCount = mode === "practice" ? 0 : Math.floor(between(rng, 0, 2.99));
  const events: (typeof REALISM_EVENTS)[number][] = [];
  while (events.length < eventCount) {
    const e = pick(rng, REALISM_EVENTS);
    if (!events.includes(e)) events.push(e);
  }

  return SessionPlanSchema.parse({
    seed: input.seed,
    mode,
    visaType: profile.visaType,
    officer,
    probes,
    targetDurationSec: Math.round(between(rng, minDur, maxDur)),
    earlyDecisionAllowed: mode !== "practice" && rng() < 0.4,
    events,
    noveltyRate: probes.length ? novel / probes.length : 1,
    notes: (input.notes ?? []).slice(0, 30).map((n) => ({ id: n.id, text: n.text, source: n.sourceKind, onScreen: isOnScreen(n.sourceKind) })),
    folder: [...new Set(input.folder ?? [])].slice(0, 20),
  });
}

export const NOTE_PROBE_PREFIX = "note:";
const NOTE_WEIGHT: Record<string, number> = { funding: 3, history: 3, employment: 2, ties: 2, family: 2, visit: 2, study: 1.5, travel: 1, other: 1 };

function pickNoteProbe(rng: Rng, notes: readonly CaseNote[], past: readonly PastSession[], mode: SessionMode): PlannedProbe | null {
  if (!notes.length || rng() > (mode === "practice" ? 0.5 : 0.75)) return null;
  const recent = new Set(past.slice(0, 2).flatMap((s) => s.probeResults.map((r) => r.probeId)));
  const fresh = notes.filter((n) => !recent.has(NOTE_PROBE_PREFIX + n.id));
  const pool = fresh.length ? fresh : notes;
  const total = pool.reduce((s, n) => s + (NOTE_WEIGHT[n.category] ?? 1), 0);
  let r = rng() * total;
  const note = pool.find((n) => (r -= NOTE_WEIGHT[n.category] ?? 1) <= 0) ?? pool[pool.length - 1];
  return noteProbe(note);
}

function noteProbe(note: CaseNote): PlannedProbe {
  const entry = isOnScreen(note.sourceKind)
    ? `Ask about this, in your own words: ${note.text}`
    : // The officer learns what's in a folder document only by looking at it.
      `Ask to see their ${documentLabel(note.sourceKind)} ("Can I see your ${documentLabel(note.sourceKind)}?"), call request_document and wait for it. Ask about what it tells you to.`;
  return {
    probeId: NOTE_PROBE_PREFIX + note.id,
    critical: false,
    entry,
    followUpVague: ["Can you be more specific?"],
    followUpContradiction: [],
    mustInclude: ["a direct explanation with the specifics"],
    reason: "case_flag",
  };
}

/**
 * A one-question drill: one topic, a fresh officer, a phrasing the applicant
 * hasn't heard lately, at most one follow-up. Returns null for an unknown topic.
 */
export function planDrill(input: DirectorInput, probeId: string): SessionPlan | null {
  const { profile, pastSessions } = input;
  const rng = createRng(input.seed);
  const recentQuestions = pastSessions.slice(0, 3).flatMap((s) => s.askedQuestions);
  let planned: PlannedProbe | null = null;

  if (probeId.startsWith(NOTE_PROBE_PREFIX)) {
    const note = (input.notes ?? []).find((n) => NOTE_PROBE_PREFIX + n.id === probeId);
    if (!note) return null;
    planned = noteProbe(note);
  } else {
    const probe = probesFor(profile.visaType).find((p) => p.id === probeId && p.entry.some((t) => isFillable(t, profile)));
    if (!probe) return null;
    const fill = (list: readonly string[]) => list.filter((t) => isFillable(t, profile)).map((t) => fillTemplate(t, profile));
    planned = {
      probeId: probe.id,
      critical: probe.critical,
      entry: chooseEntry(rng, probe, profile, recentQuestions).text,
      followUpVague: fill(probe.followUpVague),
      followUpContradiction: fill(probe.followUpContradiction),
      mustInclude: probe.mustInclude(profile),
      reason: probeStatus(probe.id, pastSessions) === "weak" ? "weak_retest" : "coverage",
    };
  }

  const officer = sampleOfficer(rng, {
    readiness: input.readiness,
    recent: pastSessions.slice(0, 3).map((s) => s.officer),
  });
  return SessionPlanSchema.parse({
    seed: input.seed,
    mode: "drill",
    visaType: profile.visaType,
    officer,
    probes: [planned],
    targetDurationSec: 45,
    earlyDecisionAllowed: false,
    events: [],
    noveltyRate: 1,
    notes: (input.notes ?? []).slice(0, 30).map((n) => ({ id: n.id, text: n.text, source: n.sourceKind, onScreen: isOnScreen(n.sourceKind) })),
    folder: [...new Set(input.folder ?? [])].slice(0, 20),
  });
}
