import Link from "next/link";
import { notFound } from "next/navigation";
import { activatePassNow, reportOutcome, setInterviewDate, startDrill, startSession } from "@/app/app/actions";
import { Button, Card, Field, inputCls, Notice, PageTitle } from "@/components/app/ui";
import { Checklist } from "@/components/case-report";
import { scanCase } from "@/lib/domain/case-scan";
import { whatToBring } from "@/lib/domain/checklist";
import { probeStatus } from "@/lib/domain/director";
import { fillTemplate, isFillable, probesFor } from "@/lib/domain/probes";
import { passWindow } from "@/lib/domain/pass";
import { requireUser } from "@/lib/server/auth";
import { caseEntitlement, getCase, latestProfile, pastSessions } from "@/lib/server/repo";
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

  const [current, history, ent, { data: sessions }, { data: passes }, { data: docs }] = await Promise.all([
    latestProfile(supabase, id),
    pastSessions(supabase, id),
    caseEntitlement(supabase, caseRow),
    supabase.from("sessions").select("id, mode, outcome, is_free, created_at, ended_at, plan").eq("case_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("passes").select("*").eq("case_id", id).is("refunded_at", null),
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
  const pass = passes?.find((p) => p.plan !== "sprint");
  const passWin = pass && interview
    ? passWindow(
        {
          purchasedAt: new Date(pass.purchased_at),
          activatedAt: pass.activated_at ? new Date(pass.activated_at) : undefined,
          interviewDate: interview,
          hasAppointmentProof: pass.has_appointment_proof,
          dateMoves: pass.date_moves,
        },
        new Date(),
      )
    : null;
  const interviewPassed = interview ? hasPassed(interview) : false;

  return (
    <>
      <Notice code={notice} />
      <PageTitle eyebrow={caseRow.visa_type === "F1" ? "F-1 student" : "B1/B2 visitor"} title={caseRow.applicant_name} />

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
              <Link href={`/app/cases/${id}/pass`} className="mt-6 inline-block rounded-[3px] bg-ink px-5 py-2.5 text-sm font-semibold text-on-ink hover:bg-stamp">
                See passes
              </Link>
            ) : (
              <div className="mt-6 flex flex-wrap gap-3">
                <form action={startSession.bind(null, id, "real")}>
                  <Button>{ent.kind === "free" ? "Start free 90-second mock" : "Real interview"}</Button>
                </form>
                {ent.kind === "full" && (
                  <>
                    <form action={startSession.bind(null, id, "practice")}>
                      <Button variant="ghost">Practice mode</Button>
                    </form>
                    <form action={startSession.bind(null, id, "dress_rehearsal")}>
                      <Button variant="ghost">Dress rehearsal</Button>
                    </form>
                  </>
                )}
              </div>
            )}
          </Card>

          {toFix.length > 0 && (
            <Card>
              <h2 className="font-display text-2xl uppercase">Answers to fix</h2>
              <p className="mt-1 text-sm text-muted">One question, a new officer each time, graded in seconds. Repeat until it&rsquo;s solid.</p>
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
                        <Link className="underline-offset-4 hover:underline" href={s.ended_at ? `/app/sessions/${s.id}/debrief` : `/app/sessions/${s.id}`}>
                          {s.ended_at ? "Debrief" : "Resume"}
                        </Link>
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
            <h2 className="font-display text-2xl uppercase">Interview date</h2>
            <form action={setInterviewDate.bind(null, id)} className="mt-4 flex gap-2">
              <input name="interviewDate" type="date" required defaultValue={interview ? interview.toISOString().slice(0, 10) : ""} className={inputCls} />
              <Button variant="ghost">Save</Button>
            </form>
            <p className="mt-2 text-xs text-muted">Upload your appointment confirmation to unlock the full pass window.</p>
          </Card>

          <Card>
            <h2 className="font-display text-2xl uppercase">Pass</h2>
            {pass ? (
              <div className="mt-2 text-sm">
                <p className="capitalize">{pass.plan === "pass" ? "Interview Pass" : `Pass + ${pass.plan}`}</p>
                {passWin && (
                  <p className="mt-1 text-muted">
                    {passWin.status === "active" && `Active until ${passWin.endsAt.toDateString()}.`}
                    {passWin.status === "pending" && `Starts ${passWin.startsAt.toDateString()}.`}
                    {passWin.status === "expired" && "Expired."}
                  </p>
                )}
                {passWin?.status === "pending" && (
                  <form action={activatePassNow.bind(null, id, pass.id)} className="mt-3">
                    <Button variant="ghost">Activate now</Button>
                  </form>
                )}
              </div>
            ) : (
              <Link href={`/app/cases/${id}/pass`} className="mt-3 inline-block text-sm underline underline-offset-4">
                See passes
              </Link>
            )}
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
