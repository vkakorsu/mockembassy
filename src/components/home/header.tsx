import Link from "next/link";
import { Logo } from "@/components/logo";

const links = [
  { href: "#how", label: "How it works" },
  { href: "#engine", label: "The officer" },
  { href: "#experts", label: "Experts" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
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
        <div className="flex items-center gap-4 text-sm">
          <Link href="/login" className="hidden underline-offset-4 hover:underline sm:inline">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-[3px] bg-ink px-4 py-2 font-semibold text-on-ink hover:bg-stamp">
            Create account
          </Link>
        </div>
      </div>
    </header>
  );
}
