import { InterviewWindow, type WindowLine } from "@/components/interview-window";

export function Hero({ lines }: { lines: WindowLine[] }) {
  return (
    <section className="grain relative isolate overflow-hidden bg-ink text-white">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_80%_20%,rgb(224_165_38/0.16),transparent_60%),radial-gradient(50%_50%_at_10%_90%,rgb(70_110_160/0.18),transparent_60%)]"
      />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-32 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-28 lg:pt-36">
        <div>
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/65">
            <span className="size-1.5 rounded-full bg-gold" />
            US visa interviews · Accra
          </p>
          <h1 className="font-display text-[clamp(3rem,6.4vw,5.6rem)]">
            Two and a half minutes.
            <br />
            <em className="text-gold">Rehearse them</em> until they&rsquo;re yours.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/70">
            Okwan is an interview simulator built for Ghanaian applicants. Upload your documents, face an officer who
            has read your case, and get an honest debrief. Every session is a different officer, as it will be on the
            day.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a
              href="#early-access"
              className="rounded-full bg-gold px-6 py-3.5 font-medium text-ink transition hover:brightness-110"
            >
              Take a free mock
            </a>
            <a href="#how" className="rounded-full px-2 py-3.5 text-white/75 underline-offset-4 hover:text-white hover:underline">
              See how it works →
            </a>
          </div>
          <p className="mt-8 text-sm text-white/45">F-1 and B1/B2 · Pay with MoMo · No approval guarantees, ever.</p>
        </div>
        <InterviewWindow lines={lines} />
      </div>
    </section>
  );
}
