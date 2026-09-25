import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanId } from "@/lib/domain/entitlement";
import { env, requireEnv } from "@/lib/env";
import { LAUNCH_PRICE_GHS, LAUNCH_PRICE_LIMIT, plans } from "@/lib/pricing";

const API = "https://api.paystack.co";

// Family passes need two linked cases; they are sold manually until that lands.
export const PURCHASABLE: PlanId[] = ["sprint", "pass", "coach", "senior"];

/** Prices in pesewas. The Interview Pass has a launch price for the first N passes. */
export async function priceFor(db: SupabaseClient, plan: PlanId): Promise<number> {
  if (plan === "family") return 599_00;
  const base = plans.find((p) => p.id === plan)?.priceGhs;
  if (base === undefined) throw new Error(`Unknown plan ${plan}`);
  if (plan === "pass") {
    const { count } = await db.from("passes").select("id", { count: "exact", head: true }).eq("plan", "pass");
    if ((count ?? 0) < LAUNCH_PRICE_LIMIT) return LAUNCH_PRICE_GHS * 100;
  }
  return base * 100;
}

/** Amounts we accept for a plan (guards against tampered metadata). */
export function allowedAmounts(plan: PlanId): number[] {
  if (plan === "pass") return [LAUNCH_PRICE_GHS * 100, 349_00];
  if (plan === "family") return [599_00];
  const base = plans.find((p) => p.id === plan)?.priceGhs;
  return base === undefined ? [] : [base * 100];
}

async function paystack<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireEnv(env.paystackSecretKey, "PAYSTACK_SECRET_KEY")}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || !json.status) throw new Error(`Paystack ${path}: ${json.message ?? res.status}`);
  return json.data as T;
}

export async function initializeTransaction(input: {
  email: string;
  amountPesewas: number;
  reference: string;
  callbackUrl: string;
  metadata: { case_id: string; user_id: string; plan: PlanId };
}) {
  return paystack<{ authorization_url: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amountPesewas,
      currency: "GHS",
      reference: input.reference,
      callback_url: input.callbackUrl,
      channels: ["mobile_money", "card"],
      metadata: input.metadata,
    }),
  });
}

export interface PaystackTransaction {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  metadata: { case_id?: string; user_id?: string; plan?: PlanId } | string | null;
}

export function verifyTransaction(reference: string) {
  return paystack<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

/** Paystack signs webhooks with HMAC-SHA512 of the raw body using the secret key. */
export function isValidSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha512", requireEnv(env.paystackSecretKey, "PAYSTACK_SECRET_KEY")).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Idempotently turns a successful transaction into a pass. Used by both the
 * webhook and the return page, whichever arrives first. Service client only.
 */
export async function recordPayment(db: SupabaseClient, tx: PaystackTransaction): Promise<"recorded" | "duplicate" | "rejected"> {
  if (tx.status !== "success" || tx.currency !== "GHS") return "rejected";
  const meta = typeof tx.metadata === "string" ? JSON.parse(tx.metadata) : tx.metadata;
  const plan = meta?.plan as PlanId | undefined;
  if (!meta?.case_id || !plan || !PURCHASABLE.includes(plan)) return "rejected";
  if (!allowedAmounts(plan).includes(tx.amount)) return "rejected";

  const { data: owner } = await db.from("cases").select("user_id").eq("id", meta.case_id).maybeSingle();
  if (!owner || owner.user_id !== meta.user_id) return "rejected";

  const { error } = await db.from("passes").insert({
    case_id: meta.case_id,
    plan,
    paystack_reference: tx.reference,
    amount_pesewas: tx.amount,
  });
  if (error?.code === "23505") return "duplicate";
  if (error) throw error;
  return "recorded";
}
