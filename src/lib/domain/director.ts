import { z } from "zod";
import type { CaseProfile } from "./case";
import { CASE_PROBE_PREFIX, type CaseQuestion } from "./case-questions";
import { scanCase } from "./case-scan";
import { documentLabel, isOnScreen, type CaseNote } from "./notes";
import { sampleOfficer, type Officer } from "./officer";
import { DOCUMENTS_FOR_PROBE, QUICK_CHECK_COVERED_BY, quickChecks } from "./quick-checks";
import { canContradict, fillTemplate, isFillable, probesFor, type Probe } from "./probes";
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
  /** For readiness (src/lib/domain/readiness.ts); absent in older callers and tests. */
  mode?: SessionMode;
  /** When the session took place (ISO). */
  at?: string;
  /** The Referee's verdict, if there was one. */
  outcome?: string | null;
  /** The independent debrief grade of each topic answered, 0..1. */
  grades?: { probeId: string; score: number }[];
  /** The applicant confirmed something that contradicts their file. */
  hadInconsistency?: boolean;
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
  /** Questions written for this applicant from their file (src/lib/domain/case-questions.ts), already checked. */
  caseQuestions?: readonly CaseQuestion[];
  /** How often each topic comes up in questions applicants report from Accra (src/lib/domain/reported.ts). */
  reportedShares?: Readonly<Record<string, number>>;
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
        /** What the officer needs to find out. The wording is the officer's own. */
        goal: z.string().max(300).optional(),
        /** Facts on the officer's file this topic can be checked against. */
        onFile: z.array(z.string().max(300)).max(16).optional(),
        /** A folder document the officer asks to see while on this topic. */
        askToSee: z.string().max(40).optional(),
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
  /** The officer verifies fingerprints at the window before questions (a common post procedure). */
  fingerprintsAtWindow: z.boolean().optional(),
  /**
   * After a key contradiction (pressed once) or two weak key answers, this
   * officer decides then and there. Most don't: they note it, carry on with
   * their other questions, and it weighs on the verdict.
   */
  decidesFast: z.boolean().optional(),
  /** After the documents, the officer confirms name and date of birth before the questions. */
  identityCheck: z.boolean().optional(),
  /** How recent officers put their questions to this applicant; this officer words them differently. */
  avoidWordings: z.array(z.string().max(200)).max(15).optional(),
  /** Short factual checks against the file, fired between topics ("Are you married?"). */
  quickChecks: z.array(z.object({ question: z.string().max(120), onFile: z.string().max(300) })).max(3).optional(),
});

export type SessionPlan = z.infer<typeof SessionPlanSchema>;
type PlannedProbe = SessionPlan["probes"][number];

export type ProbeStatus = "untested" | "weak" | "improving" | "solid";

/**
 * A weakness counts as fixed only after ≥2 distinct officers saw it answered
 * well, one of them tough (the same rule as readiness, src/lib/domain/readiness.ts).
 */
export function probeStatus(probeId: string, sessions: readonly PastSession[]): ProbeStatus {
  // sessions are most-recent first; walk oldest -> newest
  const results = sessions
    .slice()
    .reverse()
    .flatMap((s) =>
      s.probeResults
        .filter((r) => r.probeId === probeId)
        .map((r) => ({ ...r, tough: s.mode === "dress_rehearsal" || s.officer.traits.scepticism >= 0.6 })),
    );
  if (results.length === 0) return "untested";
  const last = results[results.length - 1];
  if (last.quality === "weak" || last.quality === "contradiction") return "weak";
  let lastBad = -1;
  results.forEach((r, i) => {
    if (r.quality === "weak" || r.quality === "contradiction") lastBad = i;
  });
  const good = results.slice(lastBad + 1);
  return new Set(good.map((r) => r.officerName)).size >= 2 && good.some((r) => r.tough) ? "solid" : "improving";
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
    // Topics Accra officers are reported to ask often come up more often.
    score += Math.min(0.8, 4 * (input.reportedShares?.[p.id] ?? 0));
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
    return plannedFromProbe(probe, profile, entry.text, reason);
  });

  // Questions only this applicant would get: one confirmed note from their own
  // documents, and one written from their file, neither asked in the last two sessions.
  const personal = [
    pickNoteProbe(rng, input.notes ?? [], pastSessions, mode),
    pickCaseQuestion(rng, input.caseQuestions ?? [], pastSessions, mode),
  ];
  for (const extra of personal) {
    if (!extra) continue;
    // Never the opener; if the plan is full, it replaces the last optional topic.
    if (probes.length >= 5) {
      const i = probes.map((p) => !p.critical && p.reason !== "weak_retest" && !isPersonal(p.probeId)).lastIndexOf(true);
      if (i < 0) continue;
      probes.splice(i, 1);
    }
    probes.splice(Math.min(probes.length, 1 + Math.floor(rng() * Math.max(1, probes.length - 1))), 0, extra);
  }

  planDocumentAsk(rng, probes, [...new Set(input.folder ?? [])], mode);

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
    // The full window choreography belongs in the dress rehearsal; elsewhere it's
    // time that doesn't train answers (and Accra's exact procedure is unconfirmed).
    fingerprintsAtWindow: mode === "dress_rehearsal",
    // Drawn last so the rest of a seeded plan doesn't change. Sceptical,
    // impatient officers are the ones likely to stop early (about 1 in 3 overall).
    decidesFast:
      mode !== "practice" &&
      rng() < Math.min(0.75, Math.max(0.1, 0.2 + 0.35 * officer.traits.scepticism + 0.25 * (1 - officer.traits.patience) - 0.1)),
    identityCheck:
      mode !== "practice" &&
      Boolean(profile.applicant.fullName || profile.applicant.dateOfBirth) &&
      rng() < (mode === "dress_rehearsal" ? 0.6 : 0.3),
    avoidWordings: recentWordings(recent),
    quickChecks: pickQuickChecks(rng, profile, probes, mode),
  });
}

/** One to three quick factual checks that no planned topic already covers. */
function pickQuickChecks(rng: Rng, profile: CaseProfile, probes: readonly PlannedProbe[], mode: SessionMode) {
  const planned = new Set(probes.map((p) => p.probeId));
  const pool = quickChecks(profile).filter((q) => !QUICK_CHECK_COVERED_BY[q.topic].some((id) => planned.has(id)));
  const n = Math.min(pool.length, mode === "practice" ? Math.floor(rng() * 2) : mode === "dress_rehearsal" ? 2 + Math.floor(rng() * 2) : 1 + Math.floor(rng() * 2));
  const out: { question: string; onFile: string }[] = [];
  while (out.length < n && pool.length) {
    const [q] = pool.splice(Math.floor(rng() * pool.length), 1);
    out.push({ question: q.question, onFile: q.onFile });
  }
  return out;
}

/**
 * Officers look at documents often (about one line in eight in real
 * transcripts). Pick one planned topic with a matching document in the folder
 * and have the officer ask to see it there.
 */
function planDocumentAsk(rng: Rng, probes: PlannedProbe[], folder: readonly string[], mode: SessionMode) {
  if (!folder.length || rng() > (mode === "practice" ? 0.3 : mode === "dress_rehearsal" ? 0.7 : 0.5)) return;
  const options = probes.flatMap((p, i) => {
    const kind = (DOCUMENTS_FOR_PROBE[p.probeId] ?? []).find((k) => folder.includes(k));
    return kind ? [{ i, kind }] : [];
  });
  if (!options.length) return;
  const { i, kind } = pick(rng, options);
  probes[i] = { ...probes[i], askToSee: kind };
}

/** The officer lines this applicant heard in their last sessions, for the officer to word differently. */
function recentWordings(recent: readonly PastSession[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of recent.flatMap((s) => s.askedQuestions)) {
    const t = q.replace(/\s+/g, " ").trim().slice(0, 200);
    if (t.length < 8 || !t.includes("?") || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= 15) break;
  }
  return out;
}

const isPersonal = (probeId: string) => probeId.startsWith(NOTE_PROBE_PREFIX) || probeId.startsWith(CASE_PROBE_PREFIX);

function plannedFromProbe(probe: Probe, profile: CaseProfile, entry: string, reason: PlannedProbe["reason"]): PlannedProbe {
  const fill = (list: readonly string[]) => list.filter((t) => isFillable(t, profile)).map((t) => fillTemplate(t, profile));
  return {
    probeId: probe.id,
    critical: probe.critical,
    entry,
    followUpVague: fill(probe.followUpVague),
    // "Your form says..." only when the file actually holds something to compare.
    followUpContradiction: canContradict(probe, profile) ? fill(probe.followUpContradiction) : [],
    mustInclude: probe.mustInclude(profile),
    goal: probe.goal,
    onFile: probe.onFile(profile).slice(0, 16),
    reason,
  };
}

function caseQuestionProbe(q: CaseQuestion): PlannedProbe {
  return {
    probeId: CASE_PROBE_PREFIX + q.id,
    critical: false,
    entry: q.question,
    followUpVague: [],
    followUpContradiction: q.facts.length ? ["That's not what your file shows."] : [],
    mustInclude: ["a direct, specific answer"],
    goal: q.goal,
    onFile: q.facts,
    reason: "case_flag",
  };
}

function pickCaseQuestion(rng: Rng, questions: readonly CaseQuestion[], past: readonly PastSession[], mode: SessionMode): PlannedProbe | null {
  if (!questions.length || rng() > (mode === "practice" ? 0.5 : mode === "dress_rehearsal" ? 0.7 : 0.6)) return null;
  const recent = new Set(past.slice(0, 2).flatMap((s) => s.probeResults.map((r) => r.probeId)));
  const fresh = questions.filter((q) => !recent.has(CASE_PROBE_PREFIX + q.id));
  return caseQuestionProbe(pick(rng, fresh.length ? fresh : questions));
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
  } else if (probeId.startsWith(CASE_PROBE_PREFIX)) {
    const q = (input.caseQuestions ?? []).find((x) => CASE_PROBE_PREFIX + x.id === probeId);
    if (!q) return null;
    planned = caseQuestionProbe(q);
  } else {
    const probe = probesFor(profile.visaType).find((p) => p.id === probeId && p.entry.some((t) => isFillable(t, profile)));
    if (!probe) return null;
    planned = plannedFromProbe(
      probe,
      profile,
      chooseEntry(rng, probe, profile, recentQuestions).text,
      probeStatus(probe.id, pastSessions) === "weak" ? "weak_retest" : "coverage",
    );
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
    avoidWordings: recentWordings(pastSessions.slice(0, 3)),
  });
}
