import Link from "next/link";
import { DailyBars } from "@/components/admin/daily-bars";
import { PageHead, Section, Stat, Table } from "@/components/admin/stat";
import { daysAgo, ghs, requireAdmin } from "@/lib/server/admin";

const nowMs = () => Date.now();
const count = (r: { count: number | null }) => r.count ?? 0;

export default async function AdminOverview() {
  const { db } = await requireAdmin();
  const now = nowMs();
  const since14 = daysAgo(13, now).slice(0, 10);

  const [waitlist, waitlist7, users, users7, cases, sessionsRes, passesRes, outcomesRes, failedDebriefs] = await Promise.all([
    db.from("waitlist").select("id", { count: "exact", head: true }),
    db.from("waitlist").select("id", { count: "exact", head: true }).gte("created_at", daysAgo(7, now)),
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", daysAgo(7, now)),
    db.from("cases").select("id", { count: "exact", head: true }),
    db.from("sessions").select("created_at, is_free, case_id").gte("created_at", `${since14}T00:00:00Z`).limit(20000),
    db.from("passes").select("plan, amount_pesewas, purchased_at, refunded_at, case_id").limit(20000),
    db.from("outcomes").select("result").limit(20000),
    db.from("sessions").select("id", { count: "exact", head: true }).eq("debrief_status", "failed").gte("created_at", daysAgo(7, now)),
  ]);

  const sessions = sessionsRes.data ?? [];
  const byDay = new Map<string, number>();
  for (let i = 13; i >= 0; i--) byDay.set(daysAgo(i, now).slice(0, 10), 0);
  for (const s of sessions) {
    const d = s.created_at.slice(0, 10);
    if (byDay.has(d)) byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  const today = new Date(now).toISOString().slice(0, 10);
  const sessions7 = sessions.filter((s) => s.created_at >= daysAgo(7, now)).length;

  const passes = passesRes.data ?? [];
  const paid = passes.filter((p) => !p.refunded_at && p.amount_pesewas > 0);
  const revenue30 = paid.filter((p) => p.purchased_at >= daysAgo(30, now)).reduce((s, p) => s + p.amount_pesewas, 0);
  const revenueAll = paid.reduce((s, p) => s + p.amount_pesewas, 0);
  const refunded = passes.filter((p) => p.refunded_at).length;
  const byPlan = new Map<string, { n: number; gross: number }>();
  for (const p of paid) {
    const cur = byPlan.get(p.plan) ?? { n: 0, gross: 0 };
    byPlan.set(p.plan, { n: cur.n + 1, gross: cur.gross + p.amount_pesewas });
  }

  const practisingCases = new Set(sessions.map((s) => s.case_id));
  const payingCases = new Set(paid.map((p) => p.case_id));
  const converted = [...practisingCases].filter((c) => payingCases.has(c)).length;

  const outcomes = outcomesRes.data ?? [];
  const approved = outcomes.filter((o) => o.result === "approved").length;

  return (
    <>
      <PageHead title="Overview">Live numbers from the database. Revenue excludes refunds and comped passes, and is shown VAT-inclusive.</PageHead>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Waitlist" value={count(waitlist)} sub={`+${count(waitlist7)} in 7 days`} />
        <Stat label="Users" value={count(users)} sub={`+${count(users7)} in 7 days`} />
        <Stat label="Sessions" value={byDay.get(today) ?? 0} sub={`today · ${sessions7} in 7 days`} />
        <Stat label="Revenue, 30 days" value={ghs(revenue30)} sub={`${ghs(revenueAll)} all time`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <DailyBars label="Interview sessions per day, last 14 days" data={[...byDay].map(([day, value]) => ({ day, value }))} />
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Cases" value={count(cases)} />
          <Stat
            label="Practising → paid"
            value={practisingCases.size ? `${Math.round((converted / practisingCases.size) * 100)}%` : "–"}
            sub={`${converted} of ${practisingCases.size} cases, 14 days`}
          />
          <Stat label="Refunds" value={refunded} />
          <Stat label="Failed debriefs" value={count(failedDebriefs)} sub="7 days" />
        </div>
      </div>

      <Section title="Passes by plan">
        <Table
          head={["Plan", "Sold", "Gross"]}
          rows={[...byPlan].sort((a, b) => b[1].gross - a[1].gross).map(([plan, v]) => [plan, v.n, ghs(v.gross)])}
          empty="No paid passes yet."
        />
      </Section>

      <Section title="Reported interview results" note="What users told us after their real interview. Self-reported and self-selected; see Real outcomes.">
        <p className="text-sm">
          {outcomes.length
            ? `${approved} approved of ${outcomes.length} reported (${Math.round((approved / outcomes.length) * 100)}%).`
            : "No results reported yet."}{" "}
          <Link href="/admin/outcomes" className="underline underline-offset-4">Details</Link>
        </p>
      </Section>
    </>
  );
}
