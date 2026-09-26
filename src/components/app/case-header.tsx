import Link from "next/link";
import { Countdown } from "@/components/app/countdown";
import { Guilloche } from "@/components/guilloche";
import type { Readiness } from "@/lib/domain/readiness";

/** The top of a case: who and what it's for, readiness, and the interview countdown. */
export function CaseHeader({
  caseId,
  visaLabel,
  subtitle,
  name,
  factsVersion,
  docCount,
  readiness,
  interviewAt,
  days,
  setDate,
}: {
  caseId: string;
  visaLabel: string;
  subtitle: string | null;
  name: string;
  factsVersion: number | null;
  docCount: number;
  readiness: Readiness;
  interviewAt: string | null;
  days: number | null;
  setDate: (formData: FormData) => Promise<void>;
}) {
  return (
    <section className="doc relative mb-8 overflow-hidden">
      <Guilloche className="guilloche pointer-events-none absolute -right-40 -top-40 w-[460px]" />
      <div className="relative grid divide-y divide-line md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] md:divide-x md:divide-y-0">
        <div className="min-w-0 p-6 sm:p-8">
          <p className="label text-muted">
            {visaLabel}
            {subtitle ? ` · ${subtitle}` : ""}
          </p>
          <h1 className="font-display mt-2 text-[clamp(2rem,4.4vw,3.4rem)] uppercase leading-[0.95]">{name}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <Link href={`/app/cases/${caseId}/profile`} className="rounded-[3px] border border-ink px-3 py-1.5 font-semibold hover:bg-ink hover:text-on-ink">
              {factsVersion ? "Your facts" : "Confirm your facts"}
            </Link>
            <Link href={`/app/cases/${caseId}/documents`} className="rounded-[3px] border border-ink px-3 py-1.5 font-semibold hover:bg-ink hover:text-on-ink">
              Documents <span className="font-normal text-muted">· {docCount}</span>
            </Link>
            <span className="text-muted">{factsVersion ? `Facts confirmed (version ${factsVersion})` : "Not confirmed yet"}</span>
          </div>
        </div>
        <div className="p-6 sm:p-8">
          <p className="label text-muted">Readiness</p>
          <p className="font-display mt-1 text-5xl tabular">{Math.round(readiness.score * 100)}%</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-fg/10">
            <div className="h-full rounded-full bg-stamp" style={{ width: `${Math.round(readiness.score * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted" title="A topic counts half after one good answer and fully once a different officer agrees; a weak answer resets it. Key topics count double.">
            {readiness.total
              ? `${readiness.answeredWell} of ${readiness.total} topics answered well · ${readiness.confirmed} confirmed by a second officer`
              : "Confirm your facts to see the topics you'll be tested on."}
          </p>
        </div>
        <div className="p-6 sm:p-8">
          <Countdown interviewAt={interviewAt} days={days} setDate={setDate} />
        </div>
      </div>
    </section>
  );
}
