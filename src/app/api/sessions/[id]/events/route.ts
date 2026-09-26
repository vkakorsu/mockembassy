import { z } from "zod";
import { applyToolCall, type OfficerToolCall } from "@/lib/server/referee-service";
import { errorResponse, HttpError, ownedSession } from "@/lib/server/session-access";

const Body = z.object({
  name: z.enum(["log_probe", "log_inconsistency", "log_document", "request_document", "scan_fingerprints", "end_interview"]),
  args: z.record(z.string(), z.unknown()),
});

/**
 * The browser relays the Officer's tool calls here; the Referee (server) applies
 * them. Elapsed time is measured from the server's own start timestamp.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/sessions/[id]/events">) {
  try {
    const { id } = await ctx.params;
    const { session, admin } = await ownedSession(id);
    if (!session.started_at) throw new HttpError(409, "Session not started");
    if (session.ended_at) throw new HttpError(409, "Session ended");
    const body = Body.parse(await req.json());
    const elapsedSec = (Date.now() - new Date(session.started_at).getTime()) / 1000;
    const result = await applyToolCall(admin, session, body as OfficerToolCall, elapsedSec);
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
