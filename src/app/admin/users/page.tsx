import Link from "next/link";
import { PageHead, Table } from "@/components/admin/stat";
import { inputCls } from "@/components/app/ui";
import { requireAdmin } from "@/lib/server/admin";

export const metadata = { title: "Users" };

export default async function AdminUsers(props: PageProps<"/admin/users">) {
  const { db } = await requireAdmin();
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  let req = db.from("profiles").select("id, phone_e164, role, created_at, cases(count)").order("created_at", { ascending: false }).limit(50);
  if (query) {
    const digits = query.replace(/\D/g, "").replace(/^0/, "");
    if (/^[0-9a-f-]{36}$/i.test(query)) req = req.eq("id", query);
    else if (digits) req = req.ilike("phone_e164", `%${digits}%`);
  }
  const { data: users } = await req;

  return (
    <>
      <PageHead title="Users">Search by phone number or user ID. Case facts and recordings are hidden; opening them is audit-logged.</PageHead>
      <form className="mt-6 flex max-w-lg gap-2">
        <input name="q" defaultValue={query} placeholder="024 000 0000 or user id" className={inputCls} />
        <button className="rounded-full bg-ink px-5 text-sm text-paper dark:bg-gold dark:text-ink">Search</button>
      </form>
      <div className="mt-6">
        <Table
          head={["Phone", "Role", "Cases", "Joined", ""]}
          rows={(users ?? []).map((u) => [
            u.phone_e164 ? `+${u.phone_e164.replace(/^\+/, "")}` : "—",
            u.role,
            (u.cases as unknown as { count: number }[])[0]?.count ?? 0,
            new Date(u.created_at).toLocaleDateString(),
            <Link key="l" href={`/admin/users/${u.id}`} className="underline underline-offset-4">
              Open
            </Link>,
          ])}
          empty={query ? "No match." : "No users yet."}
        />
      </div>
    </>
  );
}
