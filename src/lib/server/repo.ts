import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CaseProfile } from "@/lib/domain/case";
import { readiness, type ReadinessTopic } from "@/lib/domain/readiness";
import type { PastSession, ProbeResult, SessionPlan } from "@/lib/domain/director";
import { creditBalance, type Balance } from "@/lib/domain/credits";
import { drillEntitlement, entitlement, type Entitlement } from "@/lib/domain/entitlement";
import { isDisposableEmail } from "@/lib/domain/abuse";
import { env, features } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

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
  /** What to bring: item ids the applicant ticked as "in my folder". */
  checklist_packed: string[];
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

/** Credits left on a case: purchases minus paid sessions that started (src/lib/domain/credits.ts). */
export async function caseCredits(db: SupabaseClient, caseId: string, now = new Date()): Promise<Balance> {
  const [{ data: passes }, { data: used }] = await Promise.all([
    db.from("passes").select("purchased_at, expires_at, interviews, drills, refunded_at").eq("case_id", caseId),
    // Only sessions that actually started count: clicking a mode and leaving costs nothing.
    db.from("sessions").select("started_at, mode").eq("case_id", caseId).eq("is_free", false).not("started_at", "is", null),
  ]);
  return creditBalance(
    (passes ?? []).map((p) => ({
      purchasedAt: new Date(p.purchased_at),
      expiresAt: new Date(p.expires_at),
      interviews: p.interviews,
      drills: p.drills,
      refunded: Boolean(p.refunded_at),
    })),
    (used ?? []).map((u) => ({ at: new Date(u.started_at), kind: u.mode === "drill" ? "drill" : "interview" })),
    now,
  );
}

/**
 * Free sessions of one kind started by this person: the free mock and free
 * drills are per inbox, so name+tag@ and Gmail-dot aliases share them
 * (profiles.email_canonical, migration 17). Reads across accounts, so it
 * uses the service client.
 */
async function freeUsed(db: SupabaseClient, userId: string, drills: boolean): Promise<number> {
  const admin = features.supabaseAdmin ? createServiceClient() : db;
  let userIds = [userId];
  const { data: me } = await admin.from("profiles").select("email_canonical").eq("id", userId).maybeSingle();
  if (me?.email_canonical) {
    const { data: same } = await admin.from("profiles").select("id").eq("email_canonical", me.email_canonical);
    userIds = [...new Set([userId, ...(same ?? []).map((p) => p.id as string)])];
  }
  let q = admin
    .from("sessions")
    .select("id, cases!inner(user_id)", { count: "exact", head: true })
    .eq("is_free", true)
    .not("started_at", "is", null)
    .in("cases.user_id", userIds);
  q = drills ? q.eq("mode", "drill") : q.neq("mode", "drill");
  const { count } = await q;
  return count ?? 0;
}

/**
 * Why this account can't have a free session right now, or null: the email
 * must be confirmed and not a throwaway inbox, and free sessions across
 * everyone have a daily ceiling (src/lib/domain/abuse.ts). Paid credits
 * aren't affected.
 */
async function freeBlocked(userId: string, now: Date): Promise<string | null> {
  if (!features.supabaseAdmin) return null;
  const admin = createServiceClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  const user = data.user;
  if (!user?.email_confirmed_at) return "Confirm your email to use your free sessions. Check your inbox for our link.";
  if (user.email && isDisposableEmail(user.email)) {
    return "Free sessions need your real email, not a throwaway inbox. Packs work with any address.";
  }
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("is_free", true)
    .gte("started_at", since);
  if ((count ?? 0) >= env.freeSessionsPerDay) return "Free sessions are full for today. Try again tomorrow, or get a pack to start now.";
  return null;
}

export async function caseEntitlement(db: SupabaseClient, caseRow: CaseRow, now = new Date()): Promise<Entitlement> {
  const [credits, freeSessionsUsed, blocked] = await Promise.all([
    caseCredits(db, caseRow.id, now),
    freeUsed(db, caseRow.user_id, false),
    freeBlocked(caseRow.user_id, now),
  ]);
  return entitlement({ credits, freeSessionsUsed, freeBlocked: blocked });
}

/** Readiness 0..1 (src/lib/domain/readiness.ts). */
export function readinessFrom(sessions: PastSession[], topics: ReadinessTopic[]): number {
  return readiness(sessions, topics).score;
}

export async function caseDrillEntitlement(db: SupabaseClient, caseRow: CaseRow, now = new Date()): Promise<Entitlement> {
  const [credits, freeDrillsUsed, blocked] = await Promise.all([
    caseCredits(db, caseRow.id, now),
    freeUsed(db, caseRow.user_id, true),
    freeBlocked(caseRow.user_id, now),
  ]);
  return drillEntitlement({ credits, freeDrillsUsed, freeBlocked: blocked });
}

/**
 * Checked again when a session actually starts (allowances count started
 * sessions only, so creating several and starting them later can't beat them).
 */
export async function canStartSession(
  db: SupabaseClient,
  session: { case_id: string; is_free: boolean; plan: { mode: string } },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: caseRow } = await db.from("cases").select("*").eq("id", session.case_id).single();
  if (!caseRow) return { ok: false, reason: "Case not found" };
  const ent =
    session.plan.mode === "drill" ? await caseDrillEntitlement(db, caseRow as CaseRow) : await caseEntitlement(db, caseRow as CaseRow);
  if (ent.kind === "none") return { ok: false, reason: ent.reason };
  // A free session needs the free allowance; a paid one needs the pass.
  if (session.is_free !== (ent.kind === "free")) return { ok: false, reason: "Your allowance changed. Go back and start again." };
  return { ok: true };
}

/** The account's applicant. One per account; an account from before that rule uses its first. */
export async function accountCaseId(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await db.from("cases").select("id").eq("user_id", userId).order("created_at").limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** What the account can still use, for the top bar: the same balance the Practice card shows. */
export async function accountCredits(db: SupabaseClient, userId: string) {
  const caseId = await accountCaseId(db, userId);
  if (!caseId) return { plan: null, interviews: 0, drills: 0, buyHref: "/app" };
  const [balance, { data: passes }] = await Promise.all([
    caseCredits(db, caseId),
    db.from("passes").select("plan").eq("case_id", caseId).is("refunded_at", null).order("purchased_at", { ascending: false }).limit(1),
  ]);
  return {
    plan: (passes?.[0]?.plan as string | undefined) ?? null,
    interviews: balance.interviews,
    drills: balance.drills,
    buyHref: `/app/cases/${caseId}/pass`,
  };
}
