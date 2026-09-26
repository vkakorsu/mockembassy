import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CaseProfile } from "@/lib/domain/case";
import { NOTE_PROBE_PREFIX, type SessionPlan } from "@/lib/domain/director";
import { documentLabel, matchDocumentKind } from "@/lib/domain/notes";
import { DECISION_LINES } from "@/lib/domain/officer-prompt";
import {
  FACT_CHECK_ID,
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
  | { name: "request_document"; args: { document: string } }
  | { name: "scan_fingerprints"; args: Record<string, never> }
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
  session: { id: string; case_id: string; profile_version: number; plan: SessionPlan; referee_state: Partial<StoredState> },
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
      // Without a planned topic it came from a quick check: a fact on the form, not the first topic.
      const probeId = call.args.probe_id && known.has(call.args.probe_id) ? call.args.probe_id : FACT_CHECK_ID;
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
    case "request_document": {
      result = { response: await documentView(db, session, call.args.document), speak: true, wrapUp: false };
      break;
    }
    case "scan_fingerprints":
      // The ten-print scan at the window doubles as the applicant's certification (9 FAM 403.5).
      result = { response: { verified: true, instruction: "Fingerprints match. Begin your questions." }, speak: true, wrapUp: false };
      break;
    case "log_document":
      state = { ...state, documentRequested: true, documentProvided: Boolean(call.args.provided) };
      break;
    case "end_interview": {
      if (session.plan.mode === "drill") {
        // Drills have no verdict: the debrief is the feedback.
        result = { response: { say_exactly: "Okay. Thank you." }, speak: true, wrapUp: false };
        break;
      }
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

  if (call.name !== "end_interview" && session.plan.mode !== "drill" && shouldEnd(state, elapsedSec)) {
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

/**
 * What the officer sees when it looks at a folder document: the confirmed
 * notes from that document, plus the matching confirmed profile facts. Never
 * raw document text, and nothing the applicant didn't confirm.
 */
async function documentView(
  db: SupabaseClient,
  session: { case_id: string; profile_version: number; plan: SessionPlan },
  requested: string,
): Promise<Record<string, unknown>> {
  const folder = session.plan.folder ?? [];
  const kind = matchDocumentKind(String(requested ?? ""), folder);
  if (!kind) {
    return {
      available: false,
      instruction:
        "The applicant didn't bring this document to practice with. Treat it as handed over and unremarkable, say 'Okay', and continue. Don't penalise them for it.",
    };
  }
  const { data } = await db
    .from("case_profiles")
    .select("profile")
    .eq("case_id", session.case_id)
    .eq("version", session.profile_version)
    .maybeSingle();
  const parsed = CaseProfile.safeParse(data?.profile);
  const p = parsed.success ? parsed.data : null;
  const facts: Record<string, unknown> =
    !p
      ? {}
      : kind === "bank_statement"
        ? { availableFundsUsd: p.funding.liquidFundsUsd, recentLargeDepositUsd: p.funding.recentLargeDepositUsd }
        : kind === "sponsor_letter"
          ? { sponsors: p.funding.sponsors }
          : kind === "employment_letter"
            ? {
                employer: p.ties.employer,
                role: p.ties.role,
                yearsEmployed: p.ties.yearsEmployed,
                monthlyIncomeGhs: p.ties.monthlyIncomeGhs,
                leaveApproved: p.ties.leaveApproved,
              }
            : kind === "business_registration"
              ? { ownsBusiness: p.ties.ownsBusiness, businessName: p.ties.businessName, businessYears: p.ties.businessYears }
              : kind === "i20" || kind === "admission_letter" || kind === "scholarship_letter"
                ? { study: { ...p.study, postStudyPlan: undefined } }
                : kind === "academic_record"
                  ? { education: p.education }
                  : kind === "invitation_letter"
                    ? { visit: p.visit }
                    : kind === "property"
                      ? { ownsProperty: p.ties.ownsProperty, propertyDetail: p.ties.propertyDetail }
                      : {};
  const notes = (session.plan.notes ?? []).filter((n) => n.source === kind);
  // The planned question about this document, if there is one.
  const planned = notes.find((n) => session.plan.probes.some((p) => p.probeId === `${NOTE_PROBE_PREFIX}${n.id}`));
  return {
    available: true,
    document: documentLabel(kind),
    facts,
    shows: notes.map((n) => n.text),
    ...(planned ? { ask_about: planned.text, probe_id: `${NOTE_PROBE_PREFIX}${planned.id}` } : {}),
    instruction: planned
      ? "Ask one short question about ask_about, in your own words, then log the answer under probe_id."
      : "React as an officer glancing at it: one short question about what stands out, or 'Okay' and move on.",
  };
}
