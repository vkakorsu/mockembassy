import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/app/auth-forms";
import { AuthShell } from "@/components/app/auth-shell";
import { env, features } from "@/lib/env";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create a free Okwan account and take your first US visa practice interview.",
  alternates: { canonical: "/signup" },
};
export const dynamic = "force-dynamic";

export default function SignUp() {
  if (!features.supabase) redirect("/setup");
  return (
    <AuthShell
      title="Create your account"
      aside={
        <Link href="/login" className="text-sm underline underline-offset-4">
          Already have one? Sign in
        </Link>
      }
    >
      <SignUpForm url={env.supabaseUrl!} publishableKey={env.supabasePublishableKey!} />
    </AuthShell>
  );
}
