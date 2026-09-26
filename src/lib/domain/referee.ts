import type { AnswerQuality, SessionPlan } from "./director";

/**
 * The Referee keeps in-session state and decides the outcome from rules, so
 * outcomes are consistent and explainable rather than the model's mood.
 * The Officer's own proposal is advisory only.
 */

export type Outcome = "approved" | "refused_214b" | "administrative_221g";
/** The applicant left before the officer had heard the key answers: no decision. */
export type SessionOutcome = Outcome | "incomplete";

export interface TurnEvaluation {
  probeId: string;
  quality: AnswerQuality;
  durationSec: number;
  inconsistency?: { field: string; said: string; onFile: string };
}

export interface RefereeState {
  plan: SessionPlan;
  turns: TurnEvaluation[];
  documentRequested: boolean;
  documentProvided: boolean;
}

export interface Decision {
  outcome: Outcome;
  reasons: string[];
}

/** Long answers lose points even when the content is right: officers have ~2.5 minutes. */
export const LONG_ANSWER_SEC = 40;

const QUALITY_SCORE: Record<AnswerQuality, number> = {
  strong: 1,
  adequate: 0.7,
  weak: 0.2,
  contradiction: 0,
};

export function createRefereeState(plan: SessionPlan): RefereeState {
  return { plan, turns: [], documentRequested: false, documentProvided: false };
}

export function recordTurn(state: RefereeState, turn: TurnEvaluation): RefereeState {
  const quality: AnswerQuality =
    turn.quality === "strong" && turn.durationSec > LONG_ANSWER_SEC ? "adequate" : turn.quality;
  return { ...state, turns: [...state.turns, { ...turn, quality }] };
}

function isCritical(state: RefereeState, probeId: string): boolean {
  return state.plan.probes.find((p) => p.probeId === probeId)?.critical ?? false;
}

export function shouldEnd(state: RefereeState, elapsedSec: number): boolean {
  if (elapsedSec >= state.plan.targetDurationSec) return true;
  // Some officers decide early: after a recorded contradiction on a key topic
  // (once they've pressed on it and heard the answer), or after two weak key
  // answers. Most note it and carry on; it still weighs on the verdict.
  // Only an explicit log_inconsistency (said vs on file) counts: a bare
  // "contradiction" judgement may come from a misheard transcript.
  if (state.plan.decidesFast && state.plan.mode !== "practice") {
    const flagged = state.turns.findIndex((t) => t.inconsistency && isCritical(state, t.probeId));
    if (flagged >= 0 && state.turns.length > flagged + 1) return true;
    const judged = finalJudgements(state).filter((t) => isCritical(state, t.probeId));
    if (judged.filter((t) => t.quality === "weak").length >= 2) return true;
  }
  const answered = new Set(state.turns.map((t) => t.probeId));
  if (state.plan.probes.every((p) => answered.has(p.probeId))) return true;
  if (state.plan.earlyDecisionAllowed) {
    const critical = state.turns.filter((t) => isCritical(state, t.probeId));
    if (critical.length >= 2 && critical.slice(0, 2).every((t) => t.quality === "strong")) return true;
  }
  return false;
}

/**
 * The officer's final view of each topic: the latest judgement after any
 * follow-ups, as a real officer weighs a topic once they've heard it out.
 * A contradiction sticks: clarifying later doesn't erase it.
 */
export function finalJudgements(state: RefereeState): TurnEvaluation[] {
  const byProbe = new Map<string, TurnEvaluation>();
  for (const t of state.turns) {
    const prev = byProbe.get(t.probeId);
    if (prev && (prev.quality === "contradiction" || prev.inconsistency)) continue;
    byProbe.set(t.probeId, t);
  }
  return [...byProbe.values()];
}

export function decide(state: RefereeState): Decision {
  const reasons: string[] = [];
  const judged = finalJudgements(state);
  const critical = judged.filter((t) => isCritical(state, t.probeId));

  const contradictions = judged.filter((t) => t.quality === "contradiction" || t.inconsistency);
  if (contradictions.some((t) => isCritical(state, t.probeId))) {
    reasons.push("An answer contradicted your DS-160 or an earlier answer on a key point.");
    return { outcome: "refused_214b", reasons };
  }

  if (state.documentRequested && !state.documentProvided) {
    reasons.push("The officer asked for a document you couldn't produce.");
    return { outcome: "administrative_221g", reasons };
  }

  if (critical.length === 0) {
    reasons.push("The key questions weren't answered clearly enough to decide.");
    return { outcome: "refused_214b", reasons };
  }

  const avg = critical.reduce((s, t) => s + QUALITY_SCORE[t.quality], 0) / critical.length;
  const weakCritical = critical.filter((t) => t.quality === "weak").length;
  // Accra refuses most F-1 applicants (81% in 2025): "adequate" across the board
  // satisfies a lenient officer but not a sceptical one.
  const bar = 0.6 + 0.25 * state.plan.officer.traits.scepticism;

  if (weakCritical >= 2 || avg < 0.45) {
    reasons.push("Several key answers didn't show strong reasons to return or clear funding.");
    return { outcome: "refused_214b", reasons };
  }
  if (weakCritical === 0) {
    if (avg >= bar) {
      reasons.push(
        critical.every((t) => t.quality === "strong")
          ? "Your key answers were clear, specific and consistent."
          : "Your key answers were acceptable, and this officer was satisfied. A stricter officer might not be.",
      );
      return { outcome: "approved", reasons };
    }
    reasons.push("Your answers were acceptable but not convincing enough for this officer.");
    return { outcome: "refused_214b", reasons };
  }
  // Exactly one weak critical answer: the rest of the case has to carry it.
  if (avg >= bar + 0.1) {
    reasons.push("One key answer was weak, but the rest of your case carried it.");
    return { outcome: "approved", reasons };
  }
  reasons.push("One key answer was weak and this officer wasn't convinced.");
  return { outcome: "refused_214b", reasons };
}

/** Critical topics in the plan that the officer never judged. */
export function uncoveredCritical(state: RefereeState): string[] {
  const answered = new Set(state.turns.map((t) => t.probeId));
  return state.plan.probes.filter((p) => p.critical && !answered.has(p.probeId)).map((p) => p.probeId);
}
