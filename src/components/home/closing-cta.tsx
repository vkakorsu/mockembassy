import Link from "next/link";
import { Guilloche } from "@/components/guilloche";

/** Closing call to action: create an account. */
export function ClosingCta() {
  return (
    <section aria-labelledby="cta-title" className="relative overflow-hidden border-b border-ink bg-ink text-on-ink">
      <Guilloche className="pointer-events-none absolute -bottom-72 -right-56 w-[760px] opacity-20" rings={22} seed={9} />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-24 sm:px-8 lg:grid-cols-12 lg:py-32">
        <h2 id="cta-title" className="font-display text-[clamp(3rem,7vw,6.4rem)] uppercase lg:col-span-8">
          Your number will be called. Walk up ready.
        </h2>
        <div className="self-end lg:col-span-4">
          <p className="text-lg leading-relaxed opacity-80">
            Create an account and take your first mock free. No card, no MoMo needed until you decide it&rsquo;s worth it.
          </p>
          <Link href="/signup" className="mt-6 inline-block rounded-[3px] bg-on-ink px-6 py-3.5 font-semibold text-ink hover:bg-stamp hover:text-on-ink">
            Create your account
          </Link>
        </div>
      </div>
    </section>
  );
}
