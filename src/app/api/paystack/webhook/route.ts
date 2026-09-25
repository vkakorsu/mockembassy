import { features } from "@/lib/env";
import { isValidSignature, recordPayment, type PaystackTransaction } from "@/lib/server/paystack";
import { createServiceClient } from "@/lib/supabase/server";

/** Paystack → us. Signature-checked, idempotent, and always answers 200 once verified. */
export async function POST(req: Request) {
  if (!features.paystack || !features.supabaseAdmin) return new Response("Not configured", { status: 503 });
  const raw = await req.text();
  if (!isValidSignature(raw, req.headers.get("x-paystack-signature"))) {
    return new Response("Invalid signature", { status: 401 });
  }
  const event = JSON.parse(raw) as { event: string; data: PaystackTransaction };
  if (event.event === "charge.success") {
    const result = await recordPayment(createServiceClient(), event.data);
    if (result === "rejected") console.warn("paystack: rejected transaction", event.data.reference);
  }
  return new Response("ok");
}
