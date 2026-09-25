import { PageHead, Stat, Table } from "@/components/admin/stat";
import { requireAdmin } from "@/lib/server/admin";

export const metadata = { title: "Waitlist" };

export default async function AdminWaitlist() {
  const { db } = await requireAdmin();
  const { data } = await db.from("waitlist").select("*").order("created_at", { ascending: false }).limit(1000);
  const rows = data ?? [];
  const byVisa = (v: string) => rows.filter((r) => r.visa_type === v).length;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHead title="Waitlist">Latest 1,000 sign-ups. The export includes only people who agreed to WhatsApp messages.</PageHead>
        <a href="/admin/waitlist/export" className="rounded-[3px] bg-ink px-5 py-2.5 text-sm font-semibold text-on-ink hover:bg-stamp">
          Export CSV
        </a>
      </div>
      <div className="mt-8 grid grid-cols-3 gap-4">
        <Stat label="F-1" value={byVisa("F1")} />
        <Stat label="B1/B2" value={byVisa("B1B2")} />
        <Stat label="Other" value={byVisa("other")} />
      </div>
      <div className="mt-8">
        <Table
          head={["Joined", "Phone", "Visa", "Interview month", "WhatsApp OK"]}
          rows={rows.map((r) => [
            new Date(r.created_at).toLocaleString(),
            r.phone_e164,
            r.visa_type,
            r.interview_month ? String(r.interview_month).slice(0, 7) : "—",
            r.consent_whatsapp ? "yes" : "no",
          ])}
          empty="No sign-ups yet."
        />
      </div>
    </>
  );
}
