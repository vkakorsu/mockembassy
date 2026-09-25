import { notFound } from "next/navigation";
import { ProfileForm } from "@/components/app/profile-form";
import { BackLink, Card, PageTitle } from "@/components/app/ui";
import type { DraftConflict } from "@/lib/domain/draft";
import { requireUser } from "@/lib/server/auth";
import { getCase, latestProfile } from "@/lib/server/repo";

export default async function ProfilePage(props: PageProps<"/app/cases/[id]/profile">) {
  const { id } = await props.params;
  const { supabase } = await requireUser(`/app/cases/${id}/profile`);
  const caseRow = await getCase(supabase, id);
  if (!caseRow) notFound();
  const current = await latestProfile(supabase, id);
  const { _conflicts, ...draft } = caseRow.draft_profile as { _conflicts?: DraftConflict[] } & Record<string, unknown>;
  const values = (current?.profile as unknown as Record<string, unknown>) ?? draft;

  return (
    <>
      <BackLink href={`/app/cases/${id}`}>{caseRow.applicant_name}</BackLink>
      <PageTitle eyebrow="Your facts" title="Confirm what's true">
        {current
          ? "These are your confirmed facts. Changing them creates a new version; your next officer uses the latest."
          : "We pre-filled what we could read from your documents. Correct anything that's wrong. The officer will only use what you confirm."}
      </PageTitle>
      {!!_conflicts?.length && (
        <Card className="mb-6 border-stamp">
          <h2 className="font-display text-2xl uppercase">Your documents disagree</h2>
          <p className="mt-1 text-sm text-muted">Officers notice this. Make sure the true value matches your DS-160.</p>
          <ul className="mt-3 space-y-1 text-sm">
            {_conflicts.map((c, i) => (
              <li key={i}>
                <span className="font-mono text-xs">{c.path}</span>: {JSON.stringify(c.existing)} vs {JSON.stringify(c.incoming)}{" "}
                <span className="text-muted">(from {c.source.replaceAll("_", " ")})</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <ProfileForm caseId={id} visaType={caseRow.visa_type} values={values} />
      </Card>
    </>
  );
}
