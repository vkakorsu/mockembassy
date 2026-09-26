"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { creditExpiry, PACKS } from "@/lib/domain/credits";
import { features } from "@/lib/env";
import { audit, requireAdmin } from "@/lib/server/admin";
import { refundTransaction } from "@/lib/server/paystack";

const Reason = z.string().trim().min(5, "Give a reason (at least 5 characters)").max(500);

/** Viewing someone's case facts is logged first; the page only shows facts backed by a fresh log entry. */
export async function viewCaseFacts(userId: string, caseId: string, formData: FormData) {
  const { admin, db } = await requireAdmin();
  const reason = Reason.parse(formData.get("reason"));
  await audit(db, { adminId: admin.id, action: "view_case_facts", targetId: caseId, reason });
  redirect(`/admin/users/${userId}?facts=${caseId}`);
}

export async function refundPass(userId: string, passId: string, formData: FormData) {
  const { admin, db } = await requireAdmin();
  const reason = Reason.parse(formData.get("reason"));
  const { data: pass } = await db.from("passes").select("id, paystack_reference, amount_pesewas, refunded_at").eq("id", passId).single();
  if (!pass || pass.refunded_at) redirect(`/admin/users/${userId}?notice=already-refunded`);
  await audit(db, { adminId: admin.id, action: "refund_pass", targetId: passId, reason, details: { reference: pass.paystack_reference } });
  // Comped passes (amount 0) have nothing to send back through Paystack.
  if (pass.amount_pesewas > 0) {
    if (!features.paystack) redirect(`/admin/users/${userId}?notice=paystack-missing`);
    await refundTransaction(pass.paystack_reference);
  }
  await db.from("passes").update({ refunded_at: new Date().toISOString() }).eq("id", passId);
  redirect(`/admin/users/${userId}?notice=refunded`);
}

export async function grantPass(userId: string, caseId: string, formData: FormData) {
  const { admin, db } = await requireAdmin();
  const reason = Reason.parse(formData.get("reason"));
  const plan = z.enum(["prep", "full", "topup"]).parse(formData.get("plan"));
  const reference = `comp_${randomUUID().replace(/-/g, "")}`;
  await audit(db, { adminId: admin.id, action: "grant_pass", targetId: caseId, reason, details: { plan, reference } });
  await db.from("passes").insert({
    case_id: caseId,
    plan,
    paystack_reference: reference,
    amount_pesewas: 0,
    interviews: PACKS[plan].interviews,
    drills: PACKS[plan].drills,
    expires_at: creditExpiry(new Date()).toISOString(),
  });
  redirect(`/admin/users/${userId}?notice=granted`);
}

export async function setRole(userId: string, formData: FormData) {
  const { admin, db } = await requireAdmin();
  const reason = Reason.parse(formData.get("reason"));
  const role = z.enum(["applicant", "coach", "senior", "admin"]).parse(formData.get("role"));
  if (userId === admin.id && role !== "admin") redirect(`/admin/users/${userId}?notice=self-demote`);
  await audit(db, { adminId: admin.id, action: "set_role", targetId: userId, reason, details: { role } });
  await db.from("profiles").update({ role }).eq("id", userId);
  redirect(`/admin/users/${userId}?notice=role-updated`);
}
