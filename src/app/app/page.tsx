import Link from "next/link";
import { redirect } from "next/navigation";
import { countdownLabel, daysUntil } from "@/lib/countdown";
import { NewCaseForm } from "@/components/app/new-case-form";
import { Card, Notice, PageTitle } from "@/components/app/ui";
import { requireUser } from "@/lib/server/auth";

export default async function Dashboard(props: PageProps<"/app">) {
  const { notice, all } = await props.searchParams;
  const { supabase } = await requireUser();
  const { data: cases } = await supabase
    .from("cases")
    .select("id, visa_type, applicant_name, interview_at, sessions(count)")
    .not("sessions.started_at", "is", null) // count only sessions that started
    .order("created_at", { ascending: false });

  // Most accounts have one applicant: go straight to it (?all shows the list and the new-case form).
  if ((cases ?? []).length === 1 && all === undefined && notice === undefined) redirect(`/app/cases/${cases![0].id}`);

  return (
    <>
      <Notice code={notice} />
      <PageTitle eyebrow="Your cases" title="Who's going to the window?">
        One case per applicant and interview. Your pass, documents and practice history live inside it.
      </PageTitle>
      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          {(cases ?? []).length === 0 && <p className="text-muted">No cases yet. Create your first one.</p>}
          {(cases ?? []).map((c) => (
            <Link key={c.id} href={`/app/cases/${c.id}`} className="block doc p-6 transition hover:border-fg/30">
              <p className="text-sm text-muted">{c.visa_type === "F1" ? "F-1 student" : "B1/B2 visitor"}</p>
              <p className="font-display mt-1 text-3xl">{c.applicant_name}</p>
              <p className="mt-2 text-sm text-muted">
                {c.interview_at ? (
                  <span className={daysUntil(c.interview_at) >= 0 && daysUntil(c.interview_at) <= 7 ? "font-semibold text-refused" : "font-semibold text-fg"}>
                    {countdownLabel(daysUntil(c.interview_at))}
                  </span>
                ) : (
                  "Interview date not set"
                )}{" "}
                ·{" "}
                {(c.sessions as unknown as { count: number }[])[0]?.count ?? 0} sessions
              </p>
            </Link>
          ))}
        </div>
        <Card>
          <h2 className="font-display text-2xl uppercase">New case</h2>
          <NewCaseForm />
        </Card>
      </div>
    </>
  );
}
