import "server-only";
import { redirect } from "next/navigation";
import { features } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function getUser() {
  if (!features.supabase) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** For pages and actions under /app. Returns the user and an RLS-scoped client. */
export async function requireUser(next = "/app") {
  if (!features.supabase) redirect("/setup");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { user: data.user, supabase };
}
