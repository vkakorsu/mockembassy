import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { env, features } from "@/lib/env";

export const metadata: Metadata = { title: "Setup", robots: { index: false } };
export const dynamic = "force-dynamic";

const rows = () => [
  {
    name: "Supabase (login, data)",
    ok: features.supabase,
    vars: "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or …_ANON_KEY)",
  },
  { name: "Supabase service key (jobs, webhooks)", ok: features.supabaseAdmin, vars: "SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)" },
  { name: `Gemini (live officer: ${env.geminiLiveModel}; grading: ${env.geminiFlashModel})`, ok: features.gemini, vars: "GEMINI_API_KEY" },
  { name: "Paystack (MoMo and card)", ok: features.paystack, vars: "PAYSTACK_SECRET_KEY" },
];

/** Shows which integrations are configured. Never prints values. */
export default function Setup() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-16">
      <Link href="/" aria-label="Okwan home">
        <Logo />
      </Link>
      <h1 className="font-display mt-10 text-5xl">Setup</h1>
      <p className="mt-3 text-muted">Add these in Vercel → Project → Settings → Environment Variables, or in .env.local. Then redeploy.</p>
      <ul className="mt-8 divide-y divide-line rounded-[4px] border border-line bg-raised">
        {rows().map((r) => (
          <li key={r.name} className="flex items-start gap-4 p-5">
            <span className={`mt-1 size-2.5 shrink-0 rounded-[3px] ${r.ok ? "bg-approved" : "bg-refused"}`} aria-hidden />
            <div>
              <p className="font-medium">
                {r.name} <span className="sr-only">{r.ok ? "configured" : "missing"}</span>
              </p>
              <p className="mt-1 font-mono text-xs text-muted">{r.vars}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted">
        Then run the migrations in <code className="font-mono">supabase/migrations</code> (supabase db push), keep
        Email auth on (email and password; phone sign-in isn&rsquo;t used), and point the Paystack webhook at{" "}
        <code className="font-mono">/api/paystack/webhook</code>.
      </p>
    </main>
  );
}
