import { CaseProfile } from "@/lib/domain/case";
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
    // A dropped connection before any answer was logged may reconnect; after that, start a new session.
    const logged = ((session.referee_state as { turns?: unknown[] }).turns ?? []).length;
    if (session.started_at && logged > 0) throw new HttpError(409, "This session already started. Start a new one.");

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
    const live = await createLiveToken(session.plan, profile);
    await admin
      .from("sessions")
      .update({ started_at: new Date().toISOString(), client_fp: clientFingerprint(req) })
      .eq("id", id);
    return Response.json({ ...live, targetDurationSec: session.plan.targetDurationSec });
  } catch (e) {
    return errorResponse(e);
  }
}
