import { PageHead, Section, Stat, Table } from "@/components/admin/stat";
import type { SessionPlan } from "@/lib/domain/director";
import { getProbe } from "@/lib/domain/probes";
import { daysAgo, requireAdmin } from "@/lib/server/admin";

export const metadata = { title: "Session quality" };

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");

export default async function AdminQuality() {
  const { db } = await requireAdmin();
  const since = daysAgo(30);
  const [{ data: sessionRows }, { data: probeRows }] = await Promise.all([
    db.from("sessions").select("plan, outcome, realism_rating, debrief_status, started_at, ended_at, mode").gte("created_at", since).limit(20000),
    db.from("probe_results").select("probe_id, quality").gte("created_at", since).limit(50000),
  ]);
  const sessions = sessionRows ?? [];
  const ended = sessions.filter((s) => s.ended_at && s.started_at);
  const rated = sessions.filter((s) => s.realism_rating);
  const avgRating = rated.length ? (rated.reduce((a, s) => a + (s.realism_rating ?? 0), 0) / rated.length).toFixed(2) : "–";
  const novelty = sessions.length
    ? sessions.reduce((a, s) => a + ((s.plan as SessionPlan)?.noveltyRate ?? 0), 0) / sessions.length
    : 0;
  const avgSecs = ended.length
    ? Math.round(ended.reduce((a, s) => a + (+new Date(s.ended_at!) - +new Date(s.started_at!)) / 1000, 0) / ended.length)
    : 0;
  const outcomes = ["approved", "refused_214b", "administrative_221g"].map((o) => [o, ended.filter((s) => s.outcome === o).length] as const);
  const debriefs = ["done", "failed", "pending", "running"].map((d) => [d, sessions.filter((s) => s.debrief_status === d).length] as const);

  const probes = new Map<string, { n: number; weak: number; contradiction: number }>();
  for (const r of probeRows ?? []) {
    const cur = probes.get(r.probe_id) ?? { n: 0, weak: 0, contradiction: 0 };
    cur.n++;
    if (r.quality === "weak") cur.weak++;
    if (r.quality === "contradiction") cur.contradiction++;
    probes.set(r.probe_id, cur);
  }
  const label = (id: string) => {
    try {
      return getProbe(id).entry[0];
    } catch {
      return id;
    }
  };

  return (
    <>
      <PageHead title="Session quality">Last 30 days. Is the officer realistic, varied and fair? See docs/PLAN.md §2.2.7.</PageHead>
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="“Felt real”" value={avgRating} sub={`out of 5 · ${rated.length} ratings`} />
        <Stat label="Question novelty" value={pct(novelty, 1)} sub="not asked in the user's last 3 sessions" />
        <Stat label="Sessions" value={sessions.length} sub={`${ended.length} finished`} />
        <Stat label="Average length" value={`${Math.floor(avgSecs / 60)}:${String(avgSecs % 60).padStart(2, "0")}`} sub="min:sec" />
      </div>

      <Section title="Simulated outcomes" note="Share of finished sessions. If nearly everyone is approved or refused, the Referee's thresholds need tuning.">
        <Table head={["Outcome", "Sessions", "Share"]} rows={outcomes.map(([o, n]) => [o, n, pct(n, ended.length)])} />
      </Section>

      <Section title="Rating distribution">
        <Table head={["Rating", "Sessions"]} rows={[5, 4, 3, 2, 1].map((r) => [r, rated.filter((s) => s.realism_rating === r).length])} />
      </Section>

      <Section title="Where applicants struggle" note="Weak or contradictory answers by topic. Topics with a high share are candidates for new drills, guides and SEO content.">
        <Table
          head={["Topic", "Sample question", "Answers", "Weak", "Contradiction"]}
          rows={[...probes]
            .sort((a, b) => (b[1].weak + b[1].contradiction) / b[1].n - (a[1].weak + a[1].contradiction) / a[1].n)
            .map(([id, v]) => [
              <span key="i" className="font-mono text-xs">{id}</span>,
              label(id),
              v.n,
              pct(v.weak, v.n),
              pct(v.contradiction, v.n),
            ])}
          empty="No graded answers yet."
        />
      </Section>

      <Section title="Debrief grading">
        <Table head={["Status", "Sessions"]} rows={debriefs.map(([d, n]) => [d, n])} />
      </Section>
    </>
  );
}
