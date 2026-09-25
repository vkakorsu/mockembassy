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
  { href: "/admin/waitlist", label: "Waitlist" },
  { href: "/admin/audit", label: "Audit log" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { admin } = await requireAdmin();
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-8">
          <Link href="/admin" className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-gold">Admin</span>
          </Link>
          <span className="hidden text-sm text-white/60 sm:inline">{admin.phone ? `+${admin.phone.replace(/^\+/, "")}` : admin.email}</span>
        </div>
        <nav aria-label="Admin" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 text-sm sm:px-8">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-full px-3 py-1.5 text-white/70 hover:bg-white/10 hover:text-white">
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
