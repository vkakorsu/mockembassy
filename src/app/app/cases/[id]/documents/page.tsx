import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteDocument } from "@/app/app/actions";
import { DocumentUploader } from "@/components/app/document-uploader";
import { BackLink, Button, Card, PageTitle } from "@/components/app/ui";
import { env, features } from "@/lib/env";
import { requireUser } from "@/lib/server/auth";
import { getCase } from "@/lib/server/repo";

const STATUS: Record<string, string> = { pending: "Reading…", done: "Read", failed: "Couldn't read" };

export default async function Documents(props: PageProps<"/app/cases/[id]/documents">) {
  const { id } = await props.params;
  const { user, supabase } = await requireUser(`/app/cases/${id}/documents`);
  const caseRow = await getCase(supabase, id);
  if (!caseRow) notFound();
  const { data: docs } = await supabase
    .from("documents")
    .select("id, kind, extraction_status, extraction_error, created_at, delete_after")
    .eq("case_id", id)
    .order("created_at", { ascending: false });

  return (
    <>
      <BackLink href={`/app/cases/${id}`}>{caseRow.applicant_name}</BackLink>
      <PageTitle eyebrow="Documents" title="What the officer will see">
        Upload what you&rsquo;ll bring to the interview. We read the facts, then you confirm them. Only confirmed facts are
        used.
      </PageTitle>
      {!features.gemini && (
        <p className="mb-6 rounded-[4px] border border-line p-4 text-sm text-muted">
          Automatic reading isn&rsquo;t configured yet (GEMINI_API_KEY). You can still upload and type your facts in by hand.
        </p>
      )}
      <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
        <Card>
          <DocumentUploader caseId={id} userId={user.id} visaType={caseRow.visa_type} supabaseUrl={env.supabaseUrl!} publishableKey={env.supabasePublishableKey!} />
        </Card>
        <Card>
          <h2 className="font-display text-2xl uppercase">Uploaded</h2>
          {(docs ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nothing yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {(docs ?? []).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    <span className="font-medium">{d.kind.replaceAll("_", " ")}</span>
                    <span className="block text-xs text-muted">
                      {STATUS[d.extraction_status]}
                      {d.extraction_error ? `: ${d.extraction_error}` : ""} · deleted {new Date(d.delete_after).toLocaleDateString()}
                    </span>
                  </span>
                  <form action={deleteDocument.bind(null, d.id)}>
                    <Button variant="ghost">Delete now</Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/app/cases/${id}/profile`} className="mt-6 inline-block rounded-[3px] bg-ink px-5 py-2.5 text-sm font-semibold text-on-ink hover:bg-stamp">
            Review and confirm facts →
          </Link>
        </Card>
      </div>
    </>
  );
}
