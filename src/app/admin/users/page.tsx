import Link from "next/link";
import { PageHead, Table } from "@/components/admin/stat";
import { inputCls } from "@/components/app/ui";
import { requireAdmin } from "@/lib/server/admin";

export const metadata = { title: "Users" };

export default async function AdminUsers(props: PageProps<"/admin/users">) {
  const { db } = await requireAdmin();
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  let req = db.from("profiles").select("id, email, phone_e164, role, created_at").order("created_at", { ascending: false }).limit(50);
  if (query) {
    const digits = query.replace(/\D/g, "").replace(/^0/, "");
    if (/^[0-9a-f-]{36}$/i.test(query)) req = req.eq("id", query);
    else if (query.includes("@") || /[a-z]/i.test(query)) req = req.ilike("email", `%${query.toLowerCase()}%`);
    else if (digits) req = req.ilike("phone_e164", `%${digits}%`);
  }
  const { data: users, error } = await req;
  const ids = (users ?? []).map((u) => u.id);
  const { data: caseRows } = ids.length ? await db.from("cases").select("user_id").in("user_id", ids) : { data: [] };
  const caseCount = new Map<string, number>();
  for (const c of caseRows ?? []) caseCount.set(c.user_id, (caseCount.get(c.user_id) ?? 0) + 1);

  return (
    <>
      <PageHead title="Users">Search by email, phone number or user ID. Case facts and recordings are hidden; opening them is audit-logged.</PageHead>
      <form className="mt-6 flex max-w-lg gap-2">
        <input name="q" defaultValue={query} placeholder="email, 024 000 0000 or user id" className={inputCls} />
        <button className="rounded-[3px] bg-ink px-5 text-sm font-semibold text-on-ink hover:bg-stamp">Search</button>
      </form>
      {error && <p role="alert" className="mt-6 text-sm text-refused">Couldn&rsquo;t load users: {error.message}</p>}
      <div className="mt-6">
        <Table
          head={["Email", "Phone", "Role", "Cases", "Joined", ""]}
          rows={(users ?? []).map((u) => [
            u.email ?? "—",
            u.phone_e164 ? `+${u.phone_e164.replace(/^\+/, "")}` : "—",
            u.role,
            caseCount.get(u.id) ?? 0,
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
