import "server-only";
import { notFound } from "next/navigation";
import { features } from "@/lib/env";
import { requireUser } from "@/lib/server/auth";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Admin gate. Non-admins get a 404 so the area's existence isn't advertised.
 * Returns a service client: admin pages read across all users, so every page
 * must go through this check first.
 */
export async function requireAdmin() {
  if (!features.supabaseAdmin) notFound();
  const { user, supabase } = await requireUser("/admin");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") notFound();
  return { admin: user, db: createServiceClient() };
}

export type AuditAction = "view_case_facts" | "refund_pass" | "grant_pass" | "set_role";

/** Writes the audit entry first; if it can't be written, the action doesn't happen. */
export async function audit(
  db: ReturnType<typeof createServiceClient>,
  entry: { adminId: string; action: AuditAction; targetId?: string; reason: string; details?: Record<string, unknown> },
) {
  const { error } = await db.from("admin_audit_log").insert({
    admin_id: entry.adminId,
    action: entry.action,
    target_id: entry.targetId ?? null,
    reason: entry.reason,
    details: entry.details ?? {},
  });
  if (error) throw new Error(`Audit log unavailable (${error.message}). Apply migration 20260926000005_admin.sql.`);
}

export const ghs = (pesewas: number) =>
  `GH₵${(pesewas / 100).toLocaleString("en-GH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const DAY = 24 * 60 * 60 * 1000;
export const daysAgo = (n: number, now = Date.now()) => new Date(now - n * DAY).toISOString();
