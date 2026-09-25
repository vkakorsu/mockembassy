"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

function toE164(input: string) {
  const d = input.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d;
  if (d.startsWith("233")) return `+${d}`;
  if (d.startsWith("0")) return `+233${d.slice(1)}`;
  return `+233${d}`;
}

export function LoginForm({ url, publishableKey, next }: { url: string; publishableKey: string; next: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient(url, publishableKey);
  const friendly = (m: string) => (/fetch|network/i.test(m) ? "Couldn't reach Okwan. Check your connection and try again." : m);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ phone: toE164(phone) });
    setBusy(false);
    if (error) setError(friendly(error.message));
    else setStage("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ phone: toE164(phone), token: code, type: "sms" });
    setBusy(false);
    if (error) setError(friendly(error.message));
    else {
      router.replace(next);
      router.refresh();
    }
  }

  async function google() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  }

  const input = "w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base text-white placeholder:text-white/30";
  return (
    <div className="mt-8 space-y-4">
      {stage === "phone" ? (
        <form onSubmit={sendCode} className="space-y-3">
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Phone number</span>
            <input className={input} type="tel" inputMode="tel" autoComplete="tel" required placeholder="024 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <button disabled={busy} className="w-full rounded-full bg-gold px-6 py-3.5 font-medium text-ink disabled:opacity-60">
            {busy ? "Sending…" : "Text me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">6-digit code sent to {toE164(phone)}</span>
            <input className={`${input} tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </label>
          <button disabled={busy} className="w-full rounded-full bg-gold px-6 py-3.5 font-medium text-ink disabled:opacity-60">
            {busy ? "Checking…" : "Sign in"}
          </button>
          <button type="button" onClick={() => setStage("phone")} className="w-full text-sm text-white/60 hover:text-white">
            Use a different number
          </button>
        </form>
      )}
      <div className="flex items-center gap-3 text-xs text-white/40">
        <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
      </div>
      <button onClick={google} className="w-full rounded-full border border-white/20 px-6 py-3.5 text-sm hover:border-white/40">
        Continue with Google
      </button>
      {error && <p role="alert" className="text-sm text-[#f0a08f]">{error}</p>}
    </div>
  );
}
