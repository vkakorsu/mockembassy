import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/app/login-form";
import { Logo } from "@/components/logo";
import { env, features } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Login(props: PageProps<"/login">) {
  if (!features.supabase) redirect("/setup");
  const { next } = await props.searchParams;
  const safeNext = typeof next === "string" && /^\/(app|admin)(\/|$)/.test(next) ? next : "/app";
  return (
    <main id="main" className="grain relative flex min-h-screen items-center justify-center bg-ink px-4 text-white">
      <div className="w-full max-w-sm">
        <Link href="/" aria-label="Okwan home">
          <Logo />
        </Link>
        <h1 className="font-display mt-10 text-5xl">Step up to the window.</h1>
        <p className="mt-3 text-white/60">Sign in with your phone number. We&rsquo;ll text you a code.</p>
        <LoginForm url={env.supabaseUrl!} publishableKey={env.supabasePublishableKey!} next={safeNext} />
      </div>
    </main>
  );
}
