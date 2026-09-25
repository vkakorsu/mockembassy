import Link from "next/link";

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8">
      {eyebrow && <p className="text-sm uppercase tracking-[0.2em] text-accent">{eyebrow}</p>}
      <h1 className="font-display mt-2 text-[clamp(2.2rem,5vw,3.4rem)]">{title}</h1>
      {children && <div className="mt-3 max-w-2xl text-muted">{children}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-line bg-raised p-6 ${className}`}>{children}</section>;
}

export function Button({ children, variant = "primary", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const cls =
    variant === "primary"
      ? "rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:opacity-90 dark:bg-gold dark:text-ink"
      : "rounded-full border border-line px-5 py-2.5 text-sm hover:border-fg/40";
  return (
    <button {...rest} className={`${cls} disabled:opacity-50 ${rest.className ?? ""}`}>
      {children}
    </button>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-6 inline-block text-sm text-muted hover:text-fg">
      ← {children}
    </Link>
  );
}

export const inputCls =
  "w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-base text-fg placeholder:text-muted/60 focus:border-fg/40";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

const NOTICES: Record<string, string> = {
  "profile-confirmed": "Profile confirmed. Your next officer will use these facts.",
  "proof-required": "You've already moved your date once. Upload your new appointment confirmation to move it again.",
  "date-in-past": "That date is in the past.",
  "outcome-thanks": "Thank you. Your result helps make the officer more realistic for the next applicant.",
  paid: "Payment received. Your pass is active.",
  "payment-pending": "We're still confirming your payment. This page will update shortly.",
};

export function Notice({ code }: { code?: string | string[] }) {
  const text = typeof code === "string" ? NOTICES[code] : undefined;
  if (!text) return null;
  return <p role="status" className="mb-6 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm">{text}</p>;
}
