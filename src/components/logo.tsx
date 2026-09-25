/** Okwan mark: a stamp-like square crossed by a single path ("okwan" = the way). */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <rect x="2" y="2" width="28" height="28" rx="3" stroke="currentColor" strokeWidth="2.5" />
      <path d="M2 22 L10 14 L15 19 L22 10 L30 17" stroke="var(--stamp)" strokeWidth="2.6" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-[1.7rem] uppercase leading-none">Okwan</span>
    </span>
  );
}
