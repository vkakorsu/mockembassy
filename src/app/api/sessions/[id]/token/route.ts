import { CaseProfile } from "@/lib/domain/case";
import { features } from "@/lib/env";
import { createLiveToken } from "@/lib/server/gemini";
import { errorResponse, HttpError, ownedSession } from "@/lib/server/session-access";

/** Mints a single-use Gemini Live token with the officer's config locked server-side. */
export async function POST(_req: Request, ctx: RouteContext<"/api/sessions/[id]/token">) {
  try {
    if (!features.gemini) throw new HttpError(503, "Gemini is not configured");
    const { id } = await ctx.params;
    const { session, admin } = await ownedSession(id);
    if (session.ended_at) throw new HttpError(409, "This session has ended");
    // A dropped connection before any answer was logged may reconnect; after that, start a new session.
    const logged = ((session.referee_state as { turns?: unknown[] }).turns ?? []).length;
    if (session.started_at && logged > 0) throw new HttpError(409, "This session already started. Start a new one.");

    const { data: prof } = await admin
      .from("case_profiles")
      .select("profile")
      .eq("case_id", session.case_id)
      .eq("version", session.profile_version)
      .single();
    const profile = CaseProfile.parse(prof!.profile);
    const live = await createLiveToken(session.plan, profile);
    await admin.from("sessions").update({ started_at: new Date().toISOString() }).eq("id", id);
    return Response.json({ ...live, targetDurationSec: session.plan.targetDurationSec });
  } catch (e) {
    return errorResponse(e);
  }
}
