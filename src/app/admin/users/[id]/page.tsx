import { notFound } from "next/navigation";
import { grantPass, refundPass, setRole, viewCaseFacts } from "@/app/admin/actions";
import { PageHead, Section, Table } from "@/components/admin/stat";
import { inputCls } from "@/components/app/ui";
import { ghs, requireAdmin } from "@/lib/server/admin";

export const metadata = { title: "User" };

const tenMinutesAgo = () => new Date(Date.now() - 10 * 60_000).toISOString();

const NOTICES: Record<string, string> = {
  refunded: "Refund sent and pass marked refunded.",
  granted: "Pass granted.",
  "role-updated": "Role updated.",
  "already-refunded": "That pass was already refunded.",
  "paystack-missing": "Paystack isn't configured, so nothing was refunded.",
  "self-demote": "You can't remove your own admin role.",
};

function ReasonForm({ action, label, children }: { action: (f: FormData) => Promise<void>; label: string; children?: React.ReactNode }) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      {children}
      <input name="reason" required minLength={5} maxLength={500} placeholder="Reason (logged)" className={`${inputCls} max-w-xs py-1.5 text-sm`} />
      <button className="rounded-[3px] border border-line px-3 py-1.5 text-sm hover:border-fg/40">{label}</button>
    </form>
  );
}

export default async function AdminUser(props: PageProps<"/admin/users/[id]">) {
  const { admin, db } = await requireAdmin();
  const { id } = await props.params;
  const { facts, notice } = await props.searchParams;

  const [{ data: profile }, { data: authUser }, { data: cases }] = await Promise.all([
    db.from("profiles").select("*").eq("id", id).maybeSingle(),
    db.auth.admin.getUserById(id),
    db
      .from("cases")
      .select("id, visa_type, applicant_name, interview_at, identity_locked_at, created_at, passes(*), sessions(id, outcome, is_free, realism_rating, created_at), outcomes(result, reported_at)")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!profile) notFound();

  // Facts are shown only when this admin logged a reason for this case in the last 10 minutes.
  let factsCase: { id: string; profile: unknown } | null = null;
  if (typeof facts === "string") {
    const { data: logged } = await db
      .from("admin_audit_log")
      .select("id")
      .eq("admin_id", admin.id)
      .eq("action", "view_case_facts")
      .eq("target_id", facts)
      .gte("created_at", tenMinutesAgo())
      .limit(1);
    if (logged?.length) {
      const { data: p } = await db.from("case_profiles").select("profile").eq("case_id", facts).order("version", { ascending: false }).limit(1).maybeSingle();
      factsCase = { id: facts, profile: p?.profile ?? null };
    }
  }

  const phone = profile.phone_e164 ? `+${String(profile.phone_e164).replace(/^\+/, "")}` : null;

  return (
    <>
      {typeof notice === "string" && NOTICES[notice] && (
        <p role="status" className="mb-6 rounded-[4px] border border-stamp bg-stamp/10 px-4 py-3 text-sm">{NOTICES[notice]}</p>
      )}
      <PageHead title={profile.email ?? authUser.user?.email ?? phone ?? "User"}>
        Joined {new Date(profile.created_at).toLocaleDateString()} · role <strong>{profile.role}</strong> · last sign-in{" "}
        {authUser.user?.last_sign_in_at ? new Date(authUser.user.last_sign_in_at).toLocaleString() : "never"}
      </PageHead>

      <Section title="Role">
        <ReasonForm action={setRole.bind(null, id)} label="Set role">
          <select name="role" defaultValue={profile.role} className={`${inputCls} w-auto py-1.5 text-sm`}>
            <option value="applicant">applicant</option>
            <option value="coach">coach</option>
            <option value="senior">senior</option>
            <option value="admin">admin</option>
          </select>
        </ReasonForm>
      </Section>

      {(cases ?? []).map((c) => {
        const sessions = (c.sessions ?? []) as { id: string; outcome: string | null; is_free: boolean; realism_rating: number | null; created_at: string }[];
        const passes = (c.passes ?? []) as { id: string; plan: string; amount_pesewas: number; paystack_reference: string; purchased_at: string; refunded_at: string | null }[];
        const outcome = (c.outcomes as unknown as { result: string } | null)?.result;
        return (
          <Section key={c.id} title={`${c.applicant_name} · ${c.visa_type === "F1" ? "F-1" : "B1/B2"}`}>
            <p className="text-sm text-muted">
              Interview {c.interview_at ? new Date(c.interview_at).toDateString() : "not set"} · {sessions.length} sessions (
              {sessions.filter((s) => s.is_free).length} free) · identity {c.identity_locked_at ? "locked" : "unlocked"}
              {outcome ? ` · reported: ${outcome}` : ""}
            </p>

            <div className="mt-4">
              <Table
                head={["Plan", "Paid", "Reference", "Bought", "Status", ""]}
                rows={passes.map((p) => [
                  p.plan,
                  p.amount_pesewas ? ghs(p.amount_pesewas) : "comped",
                  <span key="r" className="font-mono text-xs">{p.paystack_reference}</span>,
                  new Date(p.purchased_at).toLocaleDateString(),
                  p.refunded_at ? `refunded ${new Date(p.refunded_at).toLocaleDateString()}` : "active",
                  p.refunded_at ? "" : <ReasonForm key="f" action={refundPass.bind(null, id, p.id)} label="Refund" />,
                ])}
                empty="No passes."
              />
            </div>

            <div className="mt-4 space-y-3 rounded-[4px] border border-line p-4">
              <p className="text-sm font-medium">Grant a comped pass</p>
              <ReasonForm action={grantPass.bind(null, id, c.id)} label="Grant">
                <select name="plan" className={`${inputCls} w-auto py-1.5 text-sm`}>
                  <option value="pass">Interview Pass</option>
                  <option value="sprint">Sprint</option>
                  <option value="coach">Pass + Coach</option>
                  <option value="senior">Pass + Senior</option>
                </select>
              </ReasonForm>
            </div>

            <div className="mt-4 rounded-[4px] border border-line p-4">
              {factsCase?.id === c.id ? (
                <>
                  <p className="text-sm font-medium">Confirmed case facts (access logged)</p>
                  <pre className="mt-3 max-h-96 overflow-auto rounded-[3px] bg-fg/[0.04] p-4 text-xs">{JSON.stringify(factsCase?.profile, null, 2) ?? "No confirmed facts."}</pre>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Case facts are hidden</p>
                  <p className="mb-3 mt-1 text-xs text-muted">Only open them for support the user asked for. Your reason is logged.</p>
                  <ReasonForm action={viewCaseFacts.bind(null, id, c.id)} label="Show facts" />
                </>
              )}
            </div>
          </Section>
        );
      })}
      {(cases ?? []).length === 0 && <p className="mt-8 text-sm text-muted">This user has no cases.</p>}
    </>
  );
}
