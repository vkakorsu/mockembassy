import Link from "next/link";
import { notFound } from "next/navigation";
import { correctTranscript, rateSession, retryDebrief } from "@/app/app/actions";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { BackLink, Button, Card, PageTitle } from "@/components/app/ui";
import type { DeliveryMetrics } from "@/lib/domain/delivery";
import type { SessionPlan } from "@/lib/domain/director";
import { requireUser } from "@/lib/server/auth";

const OUTCOME = {
  approved: { title: "Approved", line: "The officer approved you in this simulation.", cls: "text-approved" },
  refused_214b: { title: "Refused under 214(b)", line: "The officer wasn't convinced in this simulation.", cls: "text-refused" },
  administrative_221g: { title: "221(g)", line: "The officer needed more information.", cls: "text-accent" },
  incomplete: { title: "No decision", line: "You left before the officer finished.", cls: "text-muted" },
} as const;

interface TurnScores {
  llm?: { directness: number; specificity: number; consistency: number; conciseness: number };
  testing?: string;
  delivery?: DeliveryMetrics;
  stronger_answer?: string | null;
  missing_evidence?: string | null;
  rewrite_blocked_terms?: string[];
}

function Score({ label, v }: { label: string; v?: number }) {
  return (
    <div className="text-center">
      <p className="font-display text-2xl uppercase tabular">{v ?? "–"}</p>
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

export default async function DebriefPage(props: PageProps<"/app/sessions/[id]/debrief">) {
  const { id } = await props.params;
  const { notice } = await props.searchParams;
  const { supabase } = await requireUser(`/app/sessions/${id}/debrief`);
  const { data: s } = await supabase
    .from("sessions")
    .select("id, case_id, plan, outcome, decision_reasons, debrief, debrief_status, realism_rating, started_at, ended_at")
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();
  const { data: turns } = await supabase
    .from("turns")
    .select("seq, officer_text, user_transcript_raw, user_transcript_corrected, started_ms, ended_ms, scores, red_flags")
    .eq("session_id", id)
    .order("seq");
  const plan = s.plan as SessionPlan;
  // The closing decision line isn't a question: hide unanswered turns after the last answer.
  const answeredText = (t: { user_transcript_raw: string | null; user_transcript_corrected: string | null }) =>
    (t.user_transcript_corrected ?? t.user_transcript_raw ?? "").trim();
  const lastAnswered = (turns ?? []).map((t) => Boolean(answeredText(t))).lastIndexOf(true);
  const shown = (turns ?? []).slice(0, lastAnswered + 1);
  const o = s.outcome ? OUTCOME[s.outcome as keyof typeof OUTCOME] : null;
  const debrief = s.debrief as { summary?: string; top_fixes?: string[]; first_minute_seqs?: number[] } | null;
  const grading = s.debrief_status === "pending" || s.debrief_status === "running";
  const seconds = s.started_at && s.ended_at ? Math.round((+new Date(s.ended_at) - +new Date(s.started_at)) / 1000) : null;

  return (
    <>
      {grading && <AutoRefresh />}
      <BackLink href={`/app/cases/${s.case_id}`}>Back to your case</BackLink>
      {notice === "regrade-limit" && (
        <p role="status" className="mb-6 text-sm text-refused">You&rsquo;ve reached the re-grade limit for this session.</p>
      )}
      <PageTitle eyebrow={`Debrief · ${plan.officer.name}${seconds ? ` · ${Math.floor(seconds / 60)}m ${seconds % 60}s` : ""}`} title={o?.title ?? "Session ended"}>
        {o?.line} This is a training signal, not a prediction.
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="font-display text-2xl uppercase">Why</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {(s.decision_reasons ?? []).map((r: string) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="font-display text-2xl uppercase">Fix these first</h2>
            {grading ? (
              <p className="mt-2 text-sm text-muted">Reviewing your answers…</p>
            ) : s.debrief_status === "failed" ? (
              <>
                <p className="mt-2 text-sm text-muted">We couldn&rsquo;t grade this session. Your transcript is below.</p>
                <form action={retryDebrief.bind(null, id)} className="mt-3">
                  <Button variant="ghost">Try grading again</Button>
                </form>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted">{debrief?.summary}</p>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
                  {(debrief?.top_fixes ?? []).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ol>
              </>
            )}
          </Card>
          <Card>
            <h2 className="font-display text-2xl uppercase">Did this feel real?</h2>
            <div className="mt-3 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <form key={n} action={rateSession.bind(null, id, n)}>
                  <button
                    aria-label={`${n} out of 5`}
                    className={`size-10 rounded-[3px] border text-sm ${s.realism_rating === n ? "border-ink bg-ink text-on-ink" : "border-line hover:border-fg/40"}`}
                  >
                    {n}
                  </button>
                </form>
              ))}
            </div>
          </Card>
          <Link href={`/app/cases/${s.case_id}`} className="inline-block rounded-[3px] bg-ink px-5 py-2.5 text-sm font-semibold text-on-ink hover:bg-stamp">
            Next officer →
          </Link>
        </div>

        <div className="space-y-4">
          {shown.length === 0 && <Card><p className="text-sm text-muted">No answers were recorded.</p></Card>}
          {shown.map((t) => {
            const sc = (t.scores ?? {}) as TurnScores;
            const answer = t.user_transcript_corrected ?? t.user_transcript_raw ?? "";
            const firstMinute = debrief?.first_minute_seqs?.includes(t.seq);
            return (
              <Card key={t.seq}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    {sc.testing ? `Testing: ${sc.testing}` : `Question ${t.seq}`}
                    {firstMinute ? " · first minute" : ""}
                  </span>
                  {sc.delivery && (
                    <span className={sc.delivery.tooLong ? "text-refused" : ""}>
                      {sc.delivery.seconds}s · {sc.delivery.words} words · {sc.delivery.fillers} fillers
                    </span>
                  )}
                </div>
                <p className="font-display mt-3 text-xl">&ldquo;{t.officer_text}&rdquo;</p>
                <p className="mt-3 text-sm leading-relaxed text-muted">{answer || <em>(no answer)</em>}</p>
                {sc.llm && (
                  <div className="mt-4 grid grid-cols-4 gap-2 rounded-[4px] border border-line py-3">
                    <Score label="Direct" v={sc.llm.directness} />
                    <Score label="Specific" v={sc.llm.specificity} />
                    <Score label="Consistent" v={sc.llm.consistency} />
                    <Score label="Concise" v={sc.llm.conciseness} />
                  </div>
                )}
                {!!t.red_flags?.length && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {t.red_flags.map((f: string) => (
                      <li key={f} className="rounded-[3px] bg-refused/10 px-2.5 py-1 text-xs text-refused">{f}</li>
                    ))}
                  </ul>
                )}
                {sc.stronger_answer && (
                  <div className="mt-4 rounded-[4px] border border-approved/30 bg-approved/5 p-4">
                    <p className="text-xs text-muted">Your answer, stronger (only your facts)</p>
                    <p className="mt-1 text-sm leading-relaxed">{sc.stronger_answer}</p>
                  </div>
                )}
                {sc.missing_evidence && <p className="mt-3 text-sm text-muted">Evidence gap: {sc.missing_evidence}</p>}
                {answer && (
                  <details className="mt-4 border-t border-line pt-3">
                    <summary className="label cursor-pointer text-muted">Did we mishear you? Correct it</summary>
                    <form action={correctTranscript.bind(null, id, t.seq)} className="mt-3 grid gap-2">
                      <textarea name="answer" defaultValue={answer} rows={3} maxLength={4000} className="w-full rounded-[3px] border border-ink bg-card p-3 text-sm" />
                      <button className="w-fit rounded-[3px] border border-ink px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-on-ink">
                        Save and re-grade
                      </button>
                    </form>
                  </details>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
