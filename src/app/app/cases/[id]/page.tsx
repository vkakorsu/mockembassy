import Link from "next/link";
import { notFound } from "next/navigation";
import { reportOutcome, setInterviewDate, startDrill, startSession } from "@/app/app/actions";
import { Button, Card, Field, inputCls, Notice, PageTitle } from "@/components/app/ui";
import { Countdown, daysUntil } from "@/components/app/countdown";
import { Checklist } from "@/components/case-report";
import { MODE_INFO } from "@/lib/modes";
import { scanCase } from "@/lib/domain/case-scan";
import { whatToBring } from "@/lib/domain/checklist";
import { probeStatus } from "@/lib/domain/director";
import { fillTemplate, isFillable, probesFor } from "@/lib/domain/probes";
import { requireUser } from "@/lib/server/auth";
import { caseCredits, caseEntitlement, getCase, latestProfile, pastSessions } from "@/lib/server/repo";
import { readiness, readinessTopics } from "@/lib/domain/readiness";

const OUTCOME: Record<string, { label: string; cls: string }> = {
  approved: { label: "Approved", cls: "bg-approved/10 text-approved" },
  refused_214b: { label: "214(b) refusal", cls: "bg-refused/10 text-refused" },
  administrative_221g: { label: "221(g)", cls: "bg-stamp/10 text-accent" },
  incomplete: { label: "Ended early", cls: "bg-fg/5 text-muted" },
};

const SEVERITY: Record<string, string> = {
  high: "bg-refused/10 text-refused",
  medium: "bg-stamp/10 text-accent",
  low: "bg-fg/5 text-muted",
};

const hasPassed = (d: Date) => d.getTime() < Date.now();

export default async function CasePage(props: PageProps<"/app/cases/[id]">) {
  const { id } = await props.params;
  const { notice } = await props.searchParams;
  const { supabase } = await requireUser(`/app/cases/${id}`);
  const caseRow = await getCase(supabase, id);
  if (!caseRow) notFound();

  const [current, history, ent, { data: sessions }, credits, { data: docs }] = await Promise.all([
    latestProfile(supabase, id),
    pastSessions(supabase, id),
    caseEntitlement(supabase, caseRow),
    // Sessions that never started (a mode clicked, then left) aren't shown or counted.
    supabase
      .from("sessions")
      .select("id, mode, outcome, is_free, created_at, started_at, ended_at, plan")
      .eq("case_id", id)
      .not("started_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(20),
    caseCredits(supabase, id),
    supabase.from("documents").select("kind").eq("case_id", id),
  ]);

  const flags = current ? scanCase(current.profile) : [];
  const topics = current ? readinessTopics(current.profile) : [];
  const relevant = topics.map((t) => t.id);
  const ready = readiness(history, topics);
  // Topics to drill: answered weakly last time, then ones still improving.
  const toFix = current
    ? probesFor(caseRow.visa_type)
        .filter((p) => relevant.includes(p.id))
        .map((p) => ({ probe: p, status: probeStatus(p.id, history) }))
        .filter((x) => x.status === "weak" || x.status === "improving")
        .sort((a, b) => (a.status === "weak" ? 0 : 1) - (b.status === "weak" ? 0 : 1))
        .slice(0, 4)
        .map(({ probe, status }) => ({
          id: probe.id,
          status,
          question: fillTemplate(probe.entry.find((t) => isFillable(t, current.profile)) ?? probe.entry[0], current.profile),
        }))
    : [];
  const interview = caseRow.interview_at ? new Date(caseRow.interview_at) : null;
  const daysToGo = caseRow.interview_at ? daysUntil(caseRow.interview_at) : null;
  const interviewPassed = interview ? hasPassed(interview) : false;

  return (
    <>
      <Notice code={notice} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle eyebrow={caseRow.visa_type === "F1" ? "F-1 student" : "B1/B2 visitor"} title={caseRow.applicant_name} />
        <Countdown interviewAt={caseRow.interview_at} caseId={id} days={daysToGo} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl uppercase">Practice</h2>
                <p className="mt-1 text-sm text-muted">{ent.reason}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-muted">Readiness</p>
                <p className="font-display text-4xl tabular">{Math.round(ready.score * 100)}%</p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-[3px] bg-fg/10">
              <div className="h-full rounded-[3px] bg-stamp" style={{ width: `${Math.round(ready.score * 100)}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">
              {ready.total
                ? `${ready.answeredWell} of ${ready.total} topics answered well${ready.answeredWell ? `, ${ready.confirmed} confirmed by a second officer` : ""}. A topic counts half after one good answer and fully once a different officer agrees; a weak answer resets it. Key topics count double.`
                : "Confirm your facts to see which topics your officer will test."}
            </p>
            {!current ? (
              <p className="mt-6 text-sm">
                First, <Link className="underline" href={`/app/cases/${id}/profile`}>confirm your facts</Link>. The officer only uses what you confirm.
              </p>
            ) : ent.kind === "none" ? (
              <>
                <ul className="mt-6 divide-y divide-line border-y border-line">
                  {(["real", "practice", "dress_rehearsal", "drill"] as const).map((m) => (
                    <li key={m} className="py-3">
                      <span className="font-semibold">{MODE_INFO[m].name}</span>
                      <span className="label ml-2 text-muted">{MODE_INFO[m].length}</span>
                      <span className="mt-1 block text-sm text-muted">{MODE_INFO[m].body}</span>
                    </li>
                  ))}
                </ul>
                <Link href={`/app/cases/${id}/pass`} className="mt-6 inline-block rounded-[3px] bg-ink px-5 py-2.5 text-sm font-semibold text-on-ink hover:bg-stamp">
                  Get interviews
                </Link>
              </>
            ) : (
              <ul className="mt-6 divide-y divide-line border-y border-line">
                {(ent.kind === "free" ? (["free"] as const) : (["real", "practice", "dress_rehearsal"] as const)).map((m, i) => {
                  const info = MODE_INFO[m];
                  return (
                    <li key={m} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
                      <span className="min-w-0 flex-1 basis-64">
                        <span className="font-semibold">{info.name}</span>
                        <span className="label ml-2 text-muted">{info.length}</span>
                        <span className="mt-1 block text-sm text-muted">{info.body}</span>
                      </span>
                      <form action={startSession.bind(null, id, m === "free" ? "real" : m)}>
                        <Button variant={i === 0 ? "primary" : "ghost"}>{m === "free" ? "Start free mock" : "Start"}</Button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {toFix.length > 0 && (
            <Card>
              <h2 className="font-display text-2xl uppercase">Answers to fix</h2>
              <p className="mt-1 text-sm text-muted">Drills: one question, a new officer each time, graded straight away. Repeat until it&rsquo;s solid.</p>
              <ul className="mt-4 divide-y divide-line">
                {toFix.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <span className="min-w-0 flex-1">
                      &ldquo;{t.question}&rdquo;
                      <span className={`ml-2 text-xs ${t.status === "weak" ? "text-refused" : "text-muted"}`}>
                        {t.status === "weak" ? "weak last time" : "improving"}
                      </span>
                    </span>
                    <form action={startDrill.bind(null, id, t.id)}>
                      <Button variant="ghost">Drill ▸</Button>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {flags.length > 0 && (
            <Card>
              <h2 className="font-display text-2xl uppercase">Case Scan</h2>
              <p className="mt-1 text-sm text-muted">Where the officer is likely to press. No approval odds, ever.</p>
              <ul className="mt-4 space-y-3">
                {flags.map((f) => (
                  <li key={f.id} className="flex items-start gap-3 rounded-[4px] border border-line p-4">
                    <span className={`mt-0.5 rounded-[3px] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider ${SEVERITY[f.severity]}`}>{f.severity}</span>
                    <span>
                      <span className="block font-medium">{f.title}</span>
                      <span className="mt-1 block text-sm text-muted">{f.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <h2 className="font-display text-2xl uppercase">Sessions</h2>
            {(sessions ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-muted">No sessions yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {(sessions ?? []).map((s) => {
                  const o = s.outcome ? OUTCOME[s.outcome] : null;
                  const officer = (s.plan as { officer?: { name?: string } })?.officer?.name;
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                      <span>
                        <span className="font-medium">{officer}</span>{" "}
                        <span className="text-muted">
                          · {s.mode.replace("_", " ")}
                          {s.is_free ? " · free" : ""} · {new Date(s.created_at).toLocaleDateString()}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        {o && <span className={`rounded-[3px] px-2 py-0.5 text-xs ${o.cls}`}>{o.label}</span>}
                        {s.ended_at ? (
                          <Link className="underline-offset-4 hover:underline" href={`/app/sessions/${s.id}/debrief`}>
                            Debrief
                          </Link>
                        ) : (
                          <span className="text-muted">Unfinished</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-display text-2xl uppercase">Your facts</h2>
            <p className="mt-1 text-sm text-muted">
              {current ? `Confirmed, version ${current.version}.` : "Not confirmed yet."} {docs?.length ?? 0} document(s) uploaded.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`/app/cases/${id}/documents`} className="rounded-[3px] border border-line px-4 py-2 text-sm hover:border-fg/40">
                Documents
              </Link>
              <Link href={`/app/cases/${id}/profile`} className="rounded-[3px] border border-line px-4 py-2 text-sm hover:border-fg/40">
                {current ? "Review facts" : "Confirm facts"}
              </Link>
            </div>
          </Card>

          {current && (
            <Card>
              <h2 className="font-display text-2xl uppercase">What to bring</h2>
              <p className="mt-1 text-sm text-muted">Built from your confirmed facts. Ticked items are uploaded here; bring the originals.</p>
              <Checklist items={whatToBring(current.profile)} uploaded={(docs ?? []).map((d) => d.kind as string)} />
            </Card>
          )}

          <Card>
            <h2 className="font-display text-2xl uppercase">Interviews left</h2>
            <p className="font-display mt-2 text-4xl tabular">
              {credits.interviews} <span className="text-base text-muted">interviews</span> · {credits.drills}{" "}
              <span className="text-base text-muted">drills</span>
            </p>
            {credits.expiresAt && <p className="mt-1 text-xs text-muted">Use by {credits.expiresAt.toDateString()}.</p>}
            <Link href={`/app/cases/${id}/pass`} className="mt-3 inline-block text-sm underline underline-offset-4">
              {credits.interviews || credits.drills ? "Get more" : "Get interviews"}
            </Link>
          </Card>

          <Card>
            <h2 id="interview-date" className="scroll-mt-6 font-display text-2xl uppercase">
              Interview date
            </h2>
            <form action={setInterviewDate.bind(null, id)} className="mt-4 flex gap-2">
              <input name="interviewDate" type="date" required defaultValue={interview ? interview.toISOString().slice(0, 10) : ""} className={inputCls} />
              <Button variant="ghost">Save</Button>
            </form>
            <p className="mt-2 text-xs text-muted">For your countdown. It doesn&rsquo;t affect what you can use.</p>
          </Card>

          {interviewPassed && (
            <Card>
              <h2 className="font-display text-2xl uppercase">How did it go?</h2>
              <form action={reportOutcome.bind(null, id)} className="mt-4 grid gap-3">
                <Field label="Result">
                  <select name="result" className={inputCls}>
                    <option value="approved">Approved</option>
                    <option value="administrative_221g">221(g)</option>
                    <option value="refused_214b">Refused, 214(b)</option>
                    <option value="refused_other">Refused, other</option>
                  </select>
                </Field>
                <Field label="Questions you were asked" hint="Comma-separated. Helps the next applicant.">
                  <input name="questions" className={inputCls} />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="consent" /> Use my questions anonymously to improve Okwan
                </label>
                <Button>Send</Button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
