import Link from "next/link";
import { Guilloche } from "@/components/guilloche";
import { Logo } from "@/components/logo";

/** Shared frame for sign-up, sign-in and password pages: a single document on paper. */
export function AuthShell({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <main id="main" className="flex min-h-screen flex-col">
      <header className="border-b border-ink">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-8">
          <Link href="/" aria-label="Okwan home">
            <Logo />
          </Link>
          {aside}
        </div>
      </header>
      <div className="flex flex-1 items-start justify-center px-4 py-12 sm:py-20">
        <div className="doc relative w-full max-w-md overflow-hidden">
          <Guilloche className="guilloche pointer-events-none absolute -right-48 -top-48 w-[460px]" />
          <div className="relative border-b border-ink px-6 py-3">
            <span className="label">Okwan · Applicant account</span>
          </div>
          <div className="relative px-6 pb-8 pt-7">
            <h1 className="font-display text-5xl uppercase">{title}</h1>
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}

export const authInput =
  "w-full rounded-[3px] border border-ink bg-card px-3.5 py-3 text-base text-fg placeholder:text-muted/70 focus:outline-2 focus:outline-stamp";
export const authButton =
  "w-full rounded-[3px] bg-ink px-6 py-3.5 font-semibold text-on-ink hover:bg-stamp disabled:opacity-60";
