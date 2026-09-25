import { notFound, redirect } from "next/navigation";
import { LiveRoom } from "@/components/app/live-room";
import type { SessionPlan } from "@/lib/domain/director";
import { env, features } from "@/lib/env";
import { requireUser } from "@/lib/server/auth";

export default async function SessionPage(props: PageProps<"/app/sessions/[id]">) {
  const { id } = await props.params;
  const { user, supabase } = await requireUser(`/app/sessions/${id}`);
  const { data: session } = await supabase.from("sessions").select("id, plan, ended_at, is_free, case_id").eq("id", id).maybeSingle();
  if (!session) notFound();
  if (session.ended_at) redirect(`/app/sessions/${id}/debrief`);
  if (!features.gemini) redirect("/setup");
  const plan = session.plan as SessionPlan;
  return (
    <div className="fixed inset-0 z-40 overflow-auto">
      <LiveRoom
        sessionId={id}
        userId={user.id}
        officerName={plan.officer.name}
        targetDurationSec={plan.targetDurationSec}
        isFree={session.is_free}
        supabaseUrl={env.supabaseUrl!}
        publishableKey={env.supabasePublishableKey!}
      />
    </div>
  );
}
