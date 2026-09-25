import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ForgotForm } from "@/components/app/auth-forms";
import { AuthShell } from "@/components/app/auth-shell";
import { env, features } from "@/lib/env";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function Forgot() {
  if (!features.supabase) redirect("/setup");
  return (
    <AuthShell title="Reset password" aside={<Link href="/login" className="text-sm underline underline-offset-4">Back to sign in</Link>}>
      <ForgotForm url={env.supabaseUrl!} publishableKey={env.supabasePublishableKey!} />
    </AuthShell>
  );
}
