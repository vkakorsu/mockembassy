import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { requireAdmin } from "@/lib/server/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Okwan" }, robots: { index: false, follow: false } };

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/quality", label: "Session quality" },
  { href: "/admin/outcomes", label: "Real outcomes" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/health", label: "Health" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { admin } = await requireAdmin();
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-8">
          <Link href="/admin" className="flex items-center gap-3">
            <Logo />
            <span className="rounded-[3px] border border-stamp px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-stamp">Admin</span>
          </Link>
          <span className="hidden text-sm text-muted sm:inline">{admin.email}</span>
        </div>
        <nav aria-label="Admin" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 text-sm sm:px-8">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-[3px] px-3 py-1.5 text-muted hover:bg-ink hover:text-on-ink">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
        {children}
      </main>
    </div>
  );
}
