import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionPlan } from "@/lib/domain/director";
import { DECISION_LINES } from "@/lib/domain/officer-prompt";
import {
  decide,
  recordTurn,
  shouldEnd,
  uncoveredCritical,
  type Decision,
  type RefereeState,
  type SessionOutcome,
  type TurnEvaluation,
} from "@/lib/domain/referee";

/**
 * Server-side Referee. Tool calls from the live Officer are applied here;
 * outcomes are decided by rules (src/lib/domain/referee.ts), never the model.
 */

interface StoredState {
  turns: TurnEvaluation[];
  documentRequested: boolean;
  documentProvided: boolean;
  decision?: Decision;
}

export type OfficerToolCall =
  | { name: "log_probe"; args: { probe_id: string; quality: TurnEvaluation["quality"]; answer_seconds?: number } }
  | { name: "log_inconsistency"; args: { probe_id?: string; field: string; said: string; on_file: string } }
  | { name: "log_document"; args: { document: string; provided: boolean } }
  | { name: "end_interview"; args: { proposed_outcome: string } };

export interface ToolResult {
  response: Record<string, unknown>;
  /** Whether the model should speak after this result. */
  speak: boolean;
  wrapUp: boolean;
  decision?: Decision;
}

function toState(plan: SessionPlan, stored: Partial<StoredState>): RefereeState {
  return {
    plan,
    turns: stored.turns ?? [],
    documentRequested: stored.documentRequested ?? false,
    documentProvided: stored.documentProvided ?? false,
  };
}

export async function applyToolCall(
  db: SupabaseClient,
  session: { id: string; plan: SessionPlan; referee_state: Partial<StoredState> },
  call: OfficerToolCall,
  elapsedSec: number,
): Promise<ToolResult> {
  let state = toState(session.plan, session.referee_state);
  const stored: StoredState = { ...state, decision: session.referee_state.decision };
  const known = new Set(session.plan.probes.map((p) => p.probeId));
  let result: ToolResult = { response: { ok: true }, speak: false, wrapUp: false };

  switch (call.name) {
    case "log_probe": {
      if (!known.has(call.args.probe_id)) break;
      const turn: TurnEvaluation = {
        probeId: call.args.probe_id,
        quality: call.args.quality,
        durationSec: Math.max(0, Number(call.args.answer_seconds ?? 0)),
      };
      state = recordTurn(state, turn);
      await db.from("probe_results").insert({
        session_id: session.id,
        probe_id: turn.probeId,
        quality: state.turns.at(-1)!.quality,
        officer_name: session.plan.officer.name,
        duration_sec: turn.durationSec,
      });
      break;
    }
    case "log_inconsistency": {
      const probeId = call.args.probe_id && known.has(call.args.probe_id) ? call.args.probe_id : session.plan.probes[0].probeId;
      state = recordTurn(state, {
        probeId,
        quality: "contradiction",
        durationSec: 0,
        inconsistency: { field: call.args.field, said: call.args.said, onFile: call.args.on_file },
      });
      await db.from("probe_results").insert({
        session_id: session.id,
        probe_id: probeId,
        quality: "contradiction",
        officer_name: session.plan.officer.name,
        inconsistency: call.args,
      });
      break;
    }
    case "log_document":
      state = { ...state, documentRequested: true, documentProvided: Boolean(call.args.provided) };
      break;
    case "end_interview": {
      const decision = stored.decision ?? decide(state);
      stored.decision = decision;
      result = {
        response: { decision: decision.outcome, say_exactly: DECISION_LINES[decision.outcome] },
        speak: true,
        wrapUp: false,
        decision,
      };
      break;
    }
  }

  if (call.name !== "end_interview" && shouldEnd(state, elapsedSec)) {
    result = { ...result, wrapUp: true };
  }

  const next: StoredState = {
    turns: state.turns,
    documentRequested: state.documentRequested,
    documentProvided: state.documentProvided,
    decision: stored.decision,
  };
  await db.from("sessions").update({ referee_state: next }).eq("id", session.id);
  return result;
}

/**
 * Outcome when the session ends. If the officer called end_interview, that
 * decision stands. At the time limit the Referee decides on what it heard. If
 * the applicant left early, before the key topics were covered, there's no
 * decision: grading an interview that never happened would mislead.
 */
export function finalDecision(
  plan: SessionPlan,
  stored: Partial<StoredState>,
  elapsedSec: number,
): { outcome: SessionOutcome; reasons: string[] } {
  if (stored.decision) return stored.decision;
  const state = toState(plan, stored);
  if (elapsedSec < plan.targetDurationSec && uncoveredCritical(state).length) {
    return {
      outcome: "incomplete",
      reasons: ["The interview ended before the officer had asked the key questions, so there's no decision."],
    };
  }
  return decide(state);
}
