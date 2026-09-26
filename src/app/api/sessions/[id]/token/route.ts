import { tokenAllowed } from "@/lib/domain/abuse";
import { CaseProfile } from "@/lib/domain/case";
import { liveBehaviour } from "@/lib/domain/live-behaviour";
import { features } from "@/lib/env";
import { clientFingerprint } from "@/lib/server/client-fingerprint";
import { createLiveToken } from "@/lib/server/gemini";
import { canStartSession } from "@/lib/server/repo";
import { errorResponse, HttpError, ownedSession } from "@/lib/server/session-access";

/** Mints a single-use Gemini Live token with the officer's config locked server-side. */
export async function POST(req: Request, ctx: RouteContext<"/api/sessions/[id]/token">) {
  try {
    if (!features.gemini) throw new HttpError(503, "Gemini is not configured");
    const { id } = await ctx.params;
    const { session, admin, user } = await ownedSession(id);
    if (session.ended_at) throw new HttpError(409, "This session has ended");
    // After answers are logged, a new token only resumes the same interview (the browser
    // holds a resumption handle), within the reconnect limits below. A fresh start would
    // hand the applicant a new officer mid-interview.
    const resume = Boolean(((await req.json().catch(() => ({}))) as { resume?: unknown }).resume);
    const logged = ((session.referee_state as { turns?: unknown[] }).turns ?? []).length;
    if (session.started_at && logged > 0 && !resume) throw new HttpError(409, "This session already started. Start a new one.");
    // Whatever the browser does, a session gets a few tokens within its own time, no more.
    const tokensIssued = (session.tokens_issued as number | null) ?? 0;
    const gate = tokenAllowed({
      startedAt: session.started_at ? new Date(session.started_at) : null,
      tokensIssued,
      tokenLifetimeSec: liveBehaviour(session.plan).tokenLifetimeSec,
      now: new Date(),
    });
    if (!gate.ok) throw new HttpError(409, gate.reason);

    // One live interview at a time per account (a shared login can't run two).
    // Tokens expire within minutes of the planned length, so 8 minutes covers any live one.
    const { data: open } = await admin
      .from("sessions")
      .select("id, cases!inner(user_id)")
      .eq("cases.user_id", user.id)
      .neq("id", id)
      .is("ended_at", null)
      .gte("started_at", new Date(Date.now() - 8 * 60_000).toISOString())
      .limit(1);
    if (open?.length) throw new HttpError(409, "You already have an interview open on another tab or device. Finish it first.");

    if (!session.started_at) {
      const allowed = await canStartSession(admin, session);
      if (!allowed.ok) throw new HttpError(402, allowed.reason);
    }

    const { data: prof } = await admin
      .from("case_profiles")
      .select("profile")
      .eq("case_id", session.case_id)
      .eq("version", session.profile_version)
      .single();
    const profile = CaseProfile.parse(prof!.profile);
    // Claim the token before minting it; two requests racing for the same count can't both win.
    const { data: claimed } = await admin
      .from("sessions")
      .update({ tokens_issued: tokensIssued + 1 })
      .eq("id", id)
      .eq("tokens_issued", tokensIssued)
      .select("id");
    if (!claimed?.length) throw new HttpError(409, "This interview is already connecting. Try again in a moment.");
    const live = await createLiveToken(session.plan, profile);
    await admin
      .from("sessions")
      // A reconnect keeps the first start: the clock (and the reconnect window) runs from there.
      .update({ started_at: session.started_at ?? new Date().toISOString(), client_fp: clientFingerprint(req) })
      .eq("id", id);
    return Response.json({ ...live, targetDurationSec: session.plan.targetDurationSec });
  } catch (e) {
    return errorResponse(e);
  }
}
