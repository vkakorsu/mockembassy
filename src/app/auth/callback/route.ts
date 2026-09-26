import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/app";
  const safeNext = /^\/(app|admin|auth\/update-password)(\/|$)/.test(next) ? next : "/app";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // The link was opened on another device/browser (or expired). The email is
    // still confirmed by Supabase, so ask the user to sign in with their password.
    if (error) return NextResponse.redirect(new URL(`/login?notice=link-used&next=${encodeURIComponent(safeNext)}`, url.origin));
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
