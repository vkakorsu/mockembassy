import Link from "next/link";
import { Mrz } from "@/components/guilloche";
import { InterviewWindow, type WindowLine } from "@/components/interview-window";

export function Hero({ lines }: { lines: WindowLine[] }) {
  return (
    <section className="border-b border-ink">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-10 sm:px-8 lg:grid-cols-12 lg:gap-10 lg:pb-24 lg:pt-16">
        <div className="min-w-0 lg:col-span-6 lg:pt-4">
          <h1 className="font-display text-[clamp(3rem,6.6vw,6.2rem)] uppercase">
            The officer has already read your file.
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed">
            Rehearse your US visa interview with an officer who knows your case. Every session is a different officer
            with different questions, and it lasts as long as that officer wants: two questions or ten. Then you get an
            honest debrief built from your own facts.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-5">
            <Link href="/signup" className="rounded-[3px] bg-ink px-6 py-3.5 font-semibold text-on-ink hover:bg-stamp">
              Start with a free mock
            </Link>
            <Link href="/scan" className="font-semibold underline decoration-2 underline-offset-[6px] hover:text-stamp">
              Free Case Scan, no signup
            </Link>
          </div>
          <p className="label mt-10 text-muted">F-1 · B1/B2 · Built for Ghanaian applicants · Pay with MoMo</p>
        </div>
        <div className="min-w-0 lg:col-span-6">
          <InterviewWindow lines={lines} />
          <Mrz className="mt-4" lines={["P GHA OKWAN PRACTICE NOT A VISA", "NO APPROVAL PROMISES EVER 0000000"]} />
        </div>
      </div>
    </section>
  );
}
