import Link from "next/link";
import { createCase } from "@/app/app/actions";
import { Button, Card, Field, inputCls, PageTitle } from "@/components/app/ui";
import { requireUser } from "@/lib/server/auth";

export default async function Dashboard() {
  const { supabase } = await requireUser();
  const { data: cases } = await supabase
    .from("cases")
    .select("id, visa_type, applicant_name, interview_at, sessions(count)")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageTitle eyebrow="Your cases" title="Who's going to the window?">
        One case per applicant and interview. Your pass, documents and practice history live inside it.
      </PageTitle>
      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          {(cases ?? []).length === 0 && <p className="text-muted">No cases yet. Create your first one.</p>}
          {(cases ?? []).map((c) => (
            <Link key={c.id} href={`/app/cases/${c.id}`} className="block rounded-3xl border border-line bg-raised p-6 transition hover:border-fg/30">
              <p className="text-sm text-muted">{c.visa_type === "F1" ? "F-1 student" : "B1/B2 visitor"}</p>
              <p className="font-display mt-1 text-3xl">{c.applicant_name}</p>
              <p className="mt-2 text-sm text-muted">
                {c.interview_at ? `Interview ${new Date(c.interview_at).toDateString()}` : "Interview date not set"} ·{" "}
                {(c.sessions as unknown as { count: number }[])[0]?.count ?? 0} sessions
              </p>
            </Link>
          ))}
        </div>
        <Card>
          <h2 className="font-display text-2xl">New case</h2>
          <form action={createCase} className="mt-5 grid gap-4">
            <Field label="Applicant's name" hint="As on the passport.">
              <input name="applicantName" required maxLength={80} className={inputCls} />
            </Field>
            <Field label="Visa">
              <select name="visaType" className={inputCls}>
                <option value="F1">F-1 student</option>
                <option value="B1B2">B1/B2 visitor</option>
              </select>
            </Field>
            <Field label="Interview date (if booked)">
              <input name="interviewDate" type="date" className={inputCls} />
            </Field>
            <Button type="submit">Create case</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
