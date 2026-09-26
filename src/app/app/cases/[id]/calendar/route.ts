import { practiceCalendar } from "@/lib/domain/calendar";
import { env, features } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Practice reminders and the interview itself as a calendar file (.ics): added
 * once, the phone does the reminding. Owner only (RLS on cases).
 */
export async function GET(_req: Request, ctx: RouteContext<"/app/cases/[id]/calendar">) {
  if (!features.supabase) return new Response("Not configured", { status: 503 });
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Sign in first", { status: 401 });
  const { data: caseRow } = await supabase.from("cases").select("id, applicant_name, interview_at").eq("id", id).maybeSingle();
  if (!caseRow) return new Response("Not found", { status: 404 });
  if (!caseRow.interview_at) return new Response("Add your interview date first", { status: 409 });

  const ics = practiceCalendar({
    caseId: caseRow.id as string,
    applicantName: caseRow.applicant_name as string,
    interviewAt: caseRow.interview_at as string,
    siteUrl: env.siteUrl,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="okwan-visa-interview.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
