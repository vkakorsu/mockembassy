import { redirect } from "next/navigation";
import { NewCaseForm } from "@/components/app/new-case-form";
import { Card, Notice, PageTitle } from "@/components/app/ui";
import { requireUser } from "@/lib/server/auth";
import { accountCaseId } from "@/lib/server/repo";

/** One account is one applicant: set up once, then this is their prep page. */
export default async function Home(props: PageProps<"/app">) {
  const { notice } = await props.searchParams;
  const { user, supabase } = await requireUser();
  const caseId = await accountCaseId(supabase, user.id);
  if (caseId) redirect(`/app/cases/${caseId}`);

  return (
    <div className="mx-auto max-w-xl">
      <Notice code={notice} />
      <PageTitle eyebrow="Set up" title="Your interview">
        Tell us who&rsquo;s going to the window and for which visa. Next you&rsquo;ll upload your documents, so every officer
        asks about you.
      </PageTitle>
      <Card>
        <NewCaseForm />
      </Card>
    </div>
  );
}
