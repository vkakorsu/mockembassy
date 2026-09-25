import type { SessionPlan } from "@/lib/domain/director";

const reasonLabel: Record<SessionPlan["probes"][number]["reason"], string> = {
  untested: "New",
  weak_retest: "Retest · new wording",
  improving: "Confirm",
  case_flag: "From your case scan",
  expert_flag: "Coach flagged",
  coverage: "Coverage",
  wildcard: "Curveball",
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Trait({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
      <span className="label text-muted">{label}</span>
      <span className="h-1.5 border border-ink">
        <span className="block h-full bg-ink" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
    </div>
  );
}

export function NeverTheSame({ sessions }: { sessions: SessionPlan[] }) {
  return (
    <section id="engine" aria-labelledby="engine-title" className="scroll-mt-4 border-b border-ink bg-card">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-28">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="label text-muted">Part 03 / 05</p>
            <h2 id="engine-title" className="font-display mt-3 text-[clamp(2.4rem,4.6vw,4rem)] uppercase">
              Never the same interview twice.
            </h2>
          </div>
          <p className="self-end text-lg leading-relaxed lg:col-span-6 lg:col-start-7">
            A Director plans each session around your case and your weak spots. A new officer, who knows only what a real
            officer would see, runs it, and ends it when they&rsquo;ve heard enough. Below: three real sessions in a row for one
            sample applicant, straight from the engine.
          </p>
        </div>
        <ol className="mt-14 grid gap-6 lg:grid-cols-3 lg:items-start">
          {sessions.map((s, i) => (
            <li key={s.seed} className={`doc flex flex-col ${i === 1 ? "lg:mt-10" : i === 2 ? "lg:mt-20" : ""}`}>
              <div className="flex items-center justify-between border-b border-ink px-5 py-3">
                <span className="label">Session {String(i + 1).padStart(2, "0")}</span>
                <span className="label tabular text-muted">planned ~{fmt(s.targetDurationSec)}</span>
              </div>
              <div className="px-5 pt-5">
                <span className="stamp text-stamp">{s.officer.name}</span>
                <div className="mt-5 space-y-2">
                  <Trait label="Pace" value={s.officer.traits.pace} />
                  <Trait label="Warmth" value={s.officer.traits.warmth} />
                  <Trait label="Scepticism" value={s.officer.traits.scepticism} />
                </div>
              </div>
              <ul className="mt-5 divide-y divide-line border-t border-line">
                {s.probes.map((p) => (
                  <li key={p.probeId} className="px-5 py-4">
                    <span className="label text-muted">{reasonLabel[p.reason]}</span>
                    <p className="font-voice mt-1 text-xl leading-snug">&ldquo;{p.entry}&rdquo;</p>
                  </li>
                ))}
              </ul>
              {s.events.length > 0 && (
                <p className="label border-t border-line px-5 py-3 text-muted">Also: {s.events.map((e) => e.replaceAll("_", " ")).join(" · ")}</p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
