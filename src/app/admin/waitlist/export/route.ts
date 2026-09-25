import { features } from "@/lib/env";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** CSV of consented waitlist contacts, for the launch WhatsApp broadcast. Admins only. */
export async function GET() {
  if (!features.supabaseAdmin) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Not found", { status: 404 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (me?.role !== "admin") return new Response("Not found", { status: 404 });

  const { data } = await createServiceClient()
    .from("waitlist")
    .select("phone_e164, visa_type, interview_month, created_at")
    .eq("consent_whatsapp", true)
    .order("created_at");
  const lines = [
    "phone,visa_type,interview_month,joined",
    ...(data ?? []).map((r) => [r.phone_e164, r.visa_type, r.interview_month ?? "", r.created_at].map(csv).join(",")),
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="okwan-waitlist-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
