import Link from "next/link";

const DAY = 24 * 60 * 60 * 1000;

/** Whole days from today (Accra time is UTC) to the interview day. */
export function daysUntil(iso: string, now = Date.now()): number {
  const day = (t: number) => Math.floor(t / DAY);
  return day(new Date(iso).getTime()) - day(now);
}

export function countdownLabel(days: number): string {
  if (days < 0) return "Interview done";
  if (days === 0) return "Interview today";
  if (days === 1) return "Interview tomorrow";
  return `${days} days to go`;
}

/** The interview countdown, shown big at the top of a case. */
export function Countdown({ interviewAt, caseId, days }: { interviewAt: string | null; caseId: string; days: number | null }) {
  if (!interviewAt || days === null) {
    return (
      <Link href={`/app/cases/${caseId}#interview-date`} className="label rounded-[3px] border border-dashed border-ink px-3 py-2 text-muted hover:text-fg">
        Set your interview date →
      </Link>
    );
  }
  const urgent = days >= 0 && days <= 7;
  return (
    <div className={`doc px-5 py-3 text-right ${urgent ? "border-2 border-refused" : ""}`}>
      <p className={`font-display text-4xl uppercase tabular sm:text-5xl ${urgent ? "text-refused" : ""}`}>
        {days > 1 ? (
          <>
            {days} <span className="text-2xl sm:text-3xl">days</span>
          </>
        ) : (
          countdownLabel(days).replace("Interview ", "")
        )}
      </p>
      <p className="label mt-1 text-muted">
        {days >= 0 ? `to your interview · ${new Date(interviewAt).toDateString()}` : `interview was ${new Date(interviewAt).toDateString()}`}
      </p>
    </div>
  );
}
