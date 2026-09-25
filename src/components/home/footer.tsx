import { Logo } from "@/components/logo";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-8 md:grid-cols-[1fr_2fr]">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-muted">Okwan means &ldquo;the way&rdquo; in Twi.</p>
        </div>
        <div className="space-y-4 text-sm leading-relaxed text-muted">
          <p>
            Okwan is an independent interview-practice tool. It is not affiliated with the U.S. Department of State,
            the U.S. Embassy in Accra, or any government. Simulated outcomes are practice signals, not predictions. We
            are not a law firm and do not provide legal advice or complete visa forms.
          </p>
          <p>© {new Date().getFullYear()} Okwan.</p>
        </div>
      </div>
    </footer>
  );
}
