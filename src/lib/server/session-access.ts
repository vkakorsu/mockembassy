import "server-only";
import { features } from "@/lib/env";
import type { SessionPlan } from "@/lib/domain/director";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Loads a session the signed-in user owns (checked through RLS), plus a service client for writes. */
export async function ownedSession(sessionId: string) {
  if (!features.supabase || !features.supabaseAdmin) throw new HttpError(503, "Supabase is not configured");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new HttpError(401, "Sign in first");
  const { data: session } = await supabase
    .from("sessions")
    .select("id, case_id, profile_version, plan, referee_state, started_at, ended_at, is_free, tokens_issued")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) throw new HttpError(404, "Session not found");
  return {
    user: auth.user,
    supabase,
    admin: createServiceClient(),
    session: session as typeof session & { plan: SessionPlan; referee_state: Record<string, unknown> },
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}
