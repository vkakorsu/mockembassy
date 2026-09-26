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

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M3 3l18 18" />}
    </svg>
  );
}

/** A password field with a show/hide button. */
function PasswordInput(props: { name: string; autoComplete: string; minLength?: number }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? "text" : "password"} required className={`${authInput} pr-12`} />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted hover:text-fg"
      >
        <EyeIcon open={!shown} />
      </button>
    </div>
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
    if (password !== String(f.get("confirm"))) return setError("The passwords don't match.");
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
        <PasswordInput name="password" minLength={8} autoComplete="new-password" />
      </Field>
      <Field label="Confirm password">
        <PasswordInput name="confirm" minLength={8} autoComplete="new-password" />
      </Field>
      <button disabled={busy} className={authButton}>{busy ? "Creating…" : "Create account"}</button>
      <ErrorLine text={error} />
      <p className="text-sm text-muted">
        Your first mock is free. By signing up you agree that practice outcomes are not predictions and that we store your
        confirmed facts to run your interviews.
      </p>
    </form>
  );
}

export function SignInForm({ url, publishableKey, next = "/app" }: Cfg) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const supabase = createClient(url, publishableKey);
    const { error } = await supabase.auth.signInWithPassword({ email: String(f.get("email")).trim(), password: String(f.get("password")) });
    if (error) {
      setBusy(false);
      return setError(friendly(error.message));
    }
    // One active login per account: signing in here signs out other devices.
    await supabase.auth.signOut({ scope: "others" });
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4">
      <Field label="Email">
        <input name="email" type="email" required autoComplete="email" className={authInput} />
      </Field>
      <Field label="Password">
        <PasswordInput name="password" autoComplete="current-password" />
      </Field>
      <button disabled={busy} className={authButton}>{busy ? "Signing in…" : "Sign in"}</button>
      <Link href="/forgot" className="text-sm underline underline-offset-4">
        Forgot password?
      </Link>
      <ErrorLine text={error} />
    </form>
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
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== String(f.get("confirm"))) return setError("The passwords don't match.");
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
        <PasswordInput name="password" minLength={8} autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password">
        <PasswordInput name="confirm" minLength={8} autoComplete="new-password" />
      </Field>
      <button disabled={busy} className={authButton}>{busy ? "Saving…" : "Save password"}</button>
      <ErrorLine text={error} />
    </form>
  );
}
