import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CaseProfile } from "@/lib/domain/case";
import type { PastSession, ProbeResult, SessionPlan } from "@/lib/domain/director";
import { drillEntitlement, entitlement, type Entitlement, type PassRow, type PlanId } from "@/lib/domain/entitlement";

/** Data access shared by pages, actions and routes. Pass an RLS-scoped client when acting as the user. */

export interface CaseRow {
  id: string;
  user_id: string;
  visa_type: "F1" | "B1B2";
  applicant_name: string;
  ds160_confirmation: string | null;
  passport_last4: string | null;
  identity_locked_at: string | null;
  interview_at: string | null;
  draft_profile: Record<string, unknown>;
  created_at: string;
}

export async function getCase(db: SupabaseClient, caseId: string): Promise<CaseRow | null> {
  const { data } = await db.from("cases").select("*").eq("id", caseId).maybeSingle();
  return data as CaseRow | null;
}

export async function latestProfile(db: SupabaseClient, caseId: string) {
  const { data } = await db
    .from("case_profiles")
    .select("version, profile")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const parsed = CaseProfile.safeParse(data.profile);
  return parsed.success ? { version: data.version as number, profile: parsed.data } : null;
}

/** Earlier sessions in the shape the Director needs (most recent first). */
export async function pastSessions(db: SupabaseClient, caseId: string, limit = 12): Promise<PastSession[]> {
  const { data: sessions } = await db
    .from("sessions")
    .select("id, plan, probe_results(probe_id, quality, officer_name)")
    .eq("case_id", caseId)
    .not("ended_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (sessions ?? []).map((s) => {
    const plan = s.plan as SessionPlan;
    const results = (s.probe_results ?? []) as { probe_id: string; quality: ProbeResult["quality"]; officer_name: string }[];
    return {
      officer: plan.officer,
      askedQuestions: plan.probes.map((p) => p.entry),
      probeResults: results.map((r) => ({ probeId: r.probe_id, quality: r.quality, officerName: r.officer_name })),
    };
  });
}

export async function caseEntitlement(db: SupabaseClient, caseRow: CaseRow, now = new Date()): Promise<Entitlement> {
  const [{ data: passes }, { data: sessions }] = await Promise.all([
    db.from("passes").select("*").eq("case_id", caseRow.id),
    // Drills don't count towards mock limits (drillEntitlement).
    db.from("sessions").select("created_at, is_free").eq("case_id", caseRow.id).neq("mode", "drill"),
  ]);
  const { count: freeUsedOnAccount } = await db
    .from("sessions")
    .select("id, cases!inner(user_id)", { count: "exact", head: true })
    .eq("is_free", true)
    .neq("mode", "drill")
    .eq("cases.user_id", caseRow.user_id);
  const interview = caseRow.interview_at ? new Date(caseRow.interview_at) : now;
  const rows: PassRow[] = (passes ?? []).map((p) => ({
    plan: p.plan as PlanId,
    purchasedAt: new Date(p.purchased_at),
    activatedAt: p.activated_at ? new Date(p.activated_at) : undefined,
    interviewDate: interview,
    hasAppointmentProof: p.has_appointment_proof,
    dateMoves: p.date_moves,
    refunded: Boolean(p.refunded_at),
  }));
  const full = (sessions ?? []).filter((s) => !s.is_free).map((s) => new Date(s.created_at));
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  return entitlement({
    passes: rows,
    fullSessionsToday: full.filter((d) => d >= startOfDay).length,
    fullSessionsSince: (since) => full.filter((d) => d >= since).length,
    // One free mock per account (FREE_MOCKS_PER_ACCOUNT), not per case.
    freeSessionsUsed: freeUsedOnAccount ?? 0,
    now,
  });
}

/** Readiness 0..1: share of relevant probes that are solid across distinct officers. */
export function readinessFrom(sessions: PastSession[], relevantProbeIds: string[]): number {
  if (!relevantProbeIds.length) return 0;
  const good = new Map<string, Set<string>>();
  for (const s of [...sessions].reverse()) {
    for (const r of s.probeResults) {
      if (r.quality === "weak" || r.quality === "contradiction") good.set(r.probeId, new Set());
      else {
        const set = good.get(r.probeId) ?? new Set<string>();
        set.add(r.officerName);
        good.set(r.probeId, set);
      }
    }
  }
  const solid = relevantProbeIds.filter((id) => (good.get(id)?.size ?? 0) >= 2).length;
  return solid / relevantProbeIds.length;
}

export async function caseDrillEntitlement(db: SupabaseClient, caseRow: CaseRow, now = new Date()): Promise<Entitlement> {
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [mock, { count: drillsToday }, { count: freeDrillsUsed }] = await Promise.all([
    caseEntitlement(db, caseRow, now),
    db
      .from("sessions")
      .select("id, cases!inner(user_id)", { count: "exact", head: true })
      .eq("mode", "drill")
      .eq("cases.user_id", caseRow.user_id)
      .gte("created_at", startOfDay.toISOString()),
    db
      .from("sessions")
      .select("id, cases!inner(user_id)", { count: "exact", head: true })
      .eq("mode", "drill")
      .eq("is_free", true)
      .eq("cases.user_id", caseRow.user_id),
  ]);
  return drillEntitlement({ mock, drillsToday: drillsToday ?? 0, freeDrillsUsed: freeDrillsUsed ?? 0 });
}
