import { Logo } from "@/components/logo";

export function Footer() {
  return (
    <footer>
      <div className="kente-rule" aria-hidden />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-8 md:grid-cols-12">
        <div className="md:col-span-4">
          <Logo />
          <p className="mt-3 text-sm text-muted">Okwan means &ldquo;the way&rdquo; in Twi.</p>
        </div>
        <div className="space-y-4 text-sm leading-relaxed text-muted md:col-span-7 md:col-start-6">
          <p>
            Okwan is an independent interview-practice tool. It is not affiliated with the U.S. Department of State, the
            U.S. Embassy in Accra, or any government. Simulated outcomes are practice signals, not predictions. We are not
            a law firm and do not provide legal advice or complete visa forms.
          </p>
          <p className="label">© {new Date().getFullYear()} Okwan</p>
        </div>
      </div>
    </footer>
  );
}
