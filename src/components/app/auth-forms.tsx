"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { authButton, authInput } from "./auth-shell";

type Cfg = { url: string; publishableKey: string; next?: string };

const friendly = (m: string) => {
  if (/fetch|network/i.test(m)) return "Couldn't reach Okwan. Check your connection and try again.";
  if (/invalid login credentials/i.test(m)) return "That email and password don't match.";
  if (/email not confirmed/i.test(m)) return "Please confirm your email first. Check your inbox for our link.";
  if (/already registered/i.test(m)) return "An account with that email already exists. Sign in instead.";
  return m;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function ErrorLine({ text }: { text: string | null }) {
  return text ? <p role="alert" className="text-sm text-refused">{text}</p> : null;
}

export function SignUpForm({ url, publishableKey }: Cfg) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim();
    const password = String(f.get("password"));
    if (password.length < 8) return setError("Use at least 8 characters.");
    setBusy(true);
    setError(null);
    const supabase = createClient(url, publishableKey);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/app` },
    });
    setBusy(false);
    if (error) return setError(friendly(error.message));
    if (data.session) {
      router.replace("/app");
      router.refresh();
    } else setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="mt-6 space-y-3">
        <span className="stamp text-stamp">Check your email</span>
        <p className="leading-relaxed">
          We sent a confirmation link to <strong>{sentTo}</strong>. Open it on this device to finish creating your account.
        </p>
        <p className="text-sm text-muted">Nothing arrived after a few minutes? Check spam, or try signing up again.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4">
      <Field label="Email">
        <input name="email" type="email" required autoComplete="email" className={authInput} />
      </Field>
      <Field label="Password (8+ characters)">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={authInput} />
      </Field>
      <button disabled={busy} className={authButton}>{busy ? "Creating…" : "Create account"}</button>
      <ErrorLine text={error} />
      <p className="text-sm text-muted">
        Your first mock is free. By signing up you agree that practice outcomes are not predictions and that we store your
        confirmed case facts to run your interviews.
      </p>
    </form>
  );
}

function toE164(input: string) {
  const d = input.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d;
  if (d.startsWith("233")) return `+${d}`;
  if (d.startsWith("0")) return `+233${d.slice(1)}`;
  return `+233${d}`;
}

export function SignInForm({ url, publishableKey, next = "/app" }: Cfg) {
  const router = useRouter();
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient(url, publishableKey);

  const done = () => {
    router.replace(next);
    router.refresh();
  };

  async function emailSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: String(f.get("email")).trim(), password: String(f.get("password")) });
    setBusy(false);
    if (error) setError(friendly(error.message));
    else done();
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ phone: toE164(phone) });
    setBusy(false);
    if (error) setError(friendly(error.message));
    else setStage("code");
  }

  async function verify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = String(new FormData(e.currentTarget).get("code"));
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ phone: toE164(phone), token, type: "sms" });
    setBusy(false);
    if (error) setError(friendly(error.message));
    else done();
  }

  return (
    <div className="mt-6 grid gap-4">
      {mode === "email" ? (
        <form onSubmit={emailSignIn} className="grid gap-4">
          <Field label="Email">
            <input name="email" type="email" required autoComplete="email" className={authInput} />
          </Field>
          <Field label="Password">
            <input name="password" type="password" required autoComplete="current-password" className={authInput} />
          </Field>
          <button disabled={busy} className={authButton}>{busy ? "Signing in…" : "Sign in"}</button>
          <div className="flex justify-between text-sm">
            <Link href="/forgot" className="underline underline-offset-4">Forgot password?</Link>
            <button type="button" onClick={() => setMode("phone")} className="underline underline-offset-4">
              Use phone instead
            </button>
          </div>
        </form>
      ) : stage === "phone" ? (
        <form onSubmit={sendCode} className="grid gap-4">
          <Field label="Phone number">
            <input type="tel" inputMode="tel" autoComplete="tel" required placeholder="024 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} className={authInput} />
          </Field>
          <button disabled={busy} className={authButton}>{busy ? "Sending…" : "Text me a code"}</button>
          <button type="button" onClick={() => setMode("email")} className="text-sm underline underline-offset-4">
            Use email instead
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="grid gap-4">
          <Field label={`6-digit code sent to ${toE164(phone)}`}>
            <input name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} className={`${authInput} tracking-[0.4em]`} />
          </Field>
          <button disabled={busy} className={authButton}>{busy ? "Checking…" : "Sign in"}</button>
        </form>
      )}
      <ErrorLine text={error} />
    </div>
  );
}

export function ForgotForm({ url, publishableKey }: Cfg) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    const { error } = await createClient(url, publishableKey).auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    });
    setBusy(false);
    // Same message whether or not the account exists, so emails can't be probed.
    if (error && /fetch|network/i.test(error.message)) setError(friendly(error.message));
    else setSent(true);
  }

  if (sent) return <p className="mt-6 leading-relaxed">If an account exists for that email, a reset link is on its way.</p>;
  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4">
      <Field label="Email">
        <input name="email" type="email" required autoComplete="email" className={authInput} />
      </Field>
      <button disabled={busy} className={authButton}>{busy ? "Sending…" : "Send reset link"}</button>
      <ErrorLine text={error} />
    </form>
  );
}

export function UpdatePasswordForm({ url, publishableKey }: Cfg) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    if (password.length < 8) return setError("Use at least 8 characters.");
    setBusy(true);
    setError(null);
    const { error } = await createClient(url, publishableKey).auth.updateUser({ password });
    setBusy(false);
    if (error) setError(friendly(error.message));
    else {
      router.replace("/app");
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4">
      <Field label="New password (8+ characters)">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={authInput} />
      </Field>
      <button disabled={busy} className={authButton}>{busy ? "Saving…" : "Save password"}</button>
      <ErrorLine text={error} />
    </form>
  );
}
