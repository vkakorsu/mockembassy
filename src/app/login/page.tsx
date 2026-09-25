import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/app/auth-forms";
import { AuthShell } from "@/components/app/auth-shell";
import { env, features } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Login(props: PageProps<"/login">) {
  if (!features.supabase) redirect("/setup");
  const { next } = await props.searchParams;
  const safeNext = typeof next === "string" && /^\/(app|admin)(\/|$)/.test(next) ? next : "/app";
  return (
    <AuthShell
      title="Sign in"
      aside={
        <Link href="/signup" className="text-sm underline underline-offset-4">
          New here? Create an account
        </Link>
      }
    >
      <SignInForm url={env.supabaseUrl!} publishableKey={env.supabasePublishableKey!} next={safeNext} />
    </AuthShell>
  );
}
