import { z } from "zod";
import { insertRow } from "@/lib/server/supabase-rest";

const Waitlist = z.object({
  phone: z
    .string()
    .transform((s) => s.replace(/[^\d+]/g, ""))
    .pipe(z.string().regex(/^\+?\d{9,15}$/)),
  visaType: z.enum(["F1", "B1B2", "other"]),
  interviewMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  consent: z.literal("on"),
});

/** Normalise Ghanaian numbers to E.164 (+233…). */
function toE164(phone: string): string {
  if (phone.startsWith("+")) return phone;
  if (phone.startsWith("233")) return `+${phone}`;
  if (phone.startsWith("0")) return `+233${phone.slice(1)}`;
  return `+233${phone}`;
}

export async function POST(request: Request) {
  const form = Object.fromEntries(await request.formData());
  const parsed = Waitlist.safeParse(form);
  if (!parsed.success) {
    return new Response("Please check your number and try again.", { status: 400 });
  }
  const { phone, visaType, interviewMonth } = parsed.data;
  const result = await insertRow("waitlist", {
    phone_e164: toE164(phone),
    visa_type: visaType,
    interview_month: interviewMonth ? `${interviewMonth}-01` : null,
    consent_whatsapp: true,
  });
  if (result === "not_configured") {
    console.error("waitlist: Supabase URL or secret key not set; signup not stored");
    return new Response("Sign-ups aren't open yet. Please try again soon.", { status: 503 });
  }
  if (result === "error") {
    return new Response("Something went wrong. Please try again.", { status: 502 });
  }
  return Response.redirect(new URL("/thanks", request.url), 303);
}
