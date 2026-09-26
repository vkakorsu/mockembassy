import Link from "next/link";
import { AuthNav } from "@/components/auth-nav";
import { Logo } from "@/components/logo";
import { env } from "@/lib/env";

// Absolute so they work from other pages (/scan) too.
const links = [
  { href: "/scan", label: "Free Case Scan" },
  { href: "/#how", label: "How it works" },
  { href: "/#engine", label: "The officer" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function Header() {
  return (
    <header className="border-b border-ink">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-8">
        <Link href="/" aria-label="Okwan home">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 text-sm md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="underline-offset-4 hover:underline">
              {l.label}
            </a>
          ))}
        </nav>
        <AuthNav url={env.supabaseUrl!} publishableKey={env.supabasePublishableKey!} />
      </div>
    </header>
  );
}
