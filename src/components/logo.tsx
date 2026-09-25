/** Okwan mark: a window frame crossed by a single path ("okwan" = the way). */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <rect x="3" y="3" width="26" height="26" rx="7" stroke="currentColor" strokeWidth="2" />
      <path d="M3 22 L10 15 L15 20 L22 11 L29 17" stroke="var(--gold)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-[1.7rem] leading-none tracking-tight">Okwan</span>
    </span>
  );
}
