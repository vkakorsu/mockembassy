import Link from "next/link";

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8">
      {eyebrow && <p className="label text-muted">{eyebrow}</p>}
      <h1 className="font-display mt-2 text-[clamp(2.4rem,5vw,3.8rem)] uppercase">{title}</h1>
      {children && <div className="mt-3 max-w-2xl leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`doc p-6 ${className}`}>{children}</section>;
}

export function Button({ children, variant = "primary", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const cls =
    variant === "primary"
      ? "rounded-[3px] bg-ink px-5 py-2.5 text-sm font-semibold text-on-ink hover:bg-stamp"
      : "rounded-[3px] border border-ink px-5 py-2.5 text-sm font-semibold hover:bg-ink hover:text-on-ink";
  return (
    <button {...rest} className={`${cls} disabled:opacity-50 ${rest.className ?? ""}`}>
      {children}
    </button>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="label mb-6 inline-block text-muted hover:text-fg">
      ← {children}
    </Link>
  );
}

export const inputCls =
  "w-full rounded-[3px] border border-ink bg-card px-3.5 py-2.5 text-base text-fg placeholder:text-muted/70 focus:outline-2 focus:outline-stamp";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

const NOTICES: Record<string, string> = {
  "profile-confirmed": "Facts confirmed. Your next officer will use them.",
  "date-in-past": "That date is in the past.",
  "outcome-thanks": "Thank you. Your result helps make the officer more realistic for the next applicant.",
  paid: "Payment received. Your interviews and drills are ready.",
  "case-limit": "An account is for one applicant. Someone else practising needs their own account.",
  "payment-pending": "We're still confirming your payment. This page will update shortly.",
  "drill-unavailable": "That question can't be drilled any more (your confirmed facts changed). Pick another from a debrief.",
};

export function Notice({ code }: { code?: string | string[] }) {
  const text = typeof code === "string" ? NOTICES[code] : undefined;
  if (!text) return null;
  return (
    <p role="status" className="doc mb-6 border-stamp px-4 py-3 text-sm">
      <span className="stamp mr-3 text-stamp">Noted</span>
      {text}
    </p>
  );
}
