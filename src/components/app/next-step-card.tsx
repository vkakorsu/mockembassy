import Link from "next/link";
import { startDrill, startSession } from "@/app/app/actions";
import type { NextStep } from "@/lib/next-step";

const DOTS: { key: keyof NextStep["progress"]; label: string }[] = [
  { key: "documents", label: "Documents" },
  { key: "facts", label: "Facts" },
  { key: "firstInterview", label: "First interview" },
  { key: "rehearsal", label: "Dress rehearsal" },
];

/** The one thing to do next, with the journey so far. */
export function NextStepCard({ caseId, step }: { caseId: string; step: NextStep }) {
  const a = step.action;
  const button = "inline-flex h-11 items-center rounded-[3px] bg-ink px-5 font-semibold text-on-ink hover:bg-stamp";
  return (
    <section aria-labelledby="next-step" className="mb-8 flex flex-wrap items-center justify-between gap-5 rounded-[var(--radius-doc)] border-2 border-ink bg-card px-6 py-5">
      <div className="min-w-0 flex-1 basis-80">
        <p className="label text-stamp">Next step</p>
        <h2 id="next-step" className="font-display mt-1 text-2xl uppercase">
          {step.title}
        </h2>
        <p className="mt-1 text-sm text-muted">{step.body}</p>
        <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1" aria-label="Your progress">
          {DOTS.map((d) => (
            <li key={d.key} className={`label flex items-center gap-1.5 ${step.progress[d.key] ? "text-fg" : "text-muted"}`}>
              <span aria-hidden className={`size-2 rounded-full ${step.progress[d.key] ? "bg-stamp" : "border border-muted"}`} />
              {d.label}
              <span className="sr-only">{step.progress[d.key] ? " (done)" : " (to do)"}</span>
            </li>
          ))}
        </ol>
      </div>
      {a.kind === "link" ? (
        <Link href={a.href} className={button}>
          {a.label} →
        </Link>
      ) : a.kind === "session" ? (
        <form action={startSession.bind(null, caseId, a.mode)}>
          <button className={button}>{a.label} →</button>
        </form>
      ) : (
        <form action={startDrill.bind(null, caseId, a.probeId)}>
          <button className={button}>{a.label} →</button>
        </form>
      )}
    </section>
  );
}
