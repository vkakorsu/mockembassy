import Link from "next/link";
import { Logo } from "@/components/logo";

const links = [
  { href: "#how", label: "How it works" },
  { href: "#never-the-same", label: "The engine" },
  { href: "#experts", label: "Experts" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Header() {
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 text-white sm:px-8">
        <Link href="/" aria-label="Okwan home">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-8 text-sm text-white/70 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition hover:text-white">
              {l.label}
            </a>
          ))}
        </nav>
        <a
          href="#early-access"
          className="rounded-full border border-white/20 px-4 py-2 text-sm text-white transition hover:border-gold hover:text-gold"
        >
          Get early access
        </a>
      </div>
    </header>
  );
}
