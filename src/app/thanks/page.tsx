import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "You're on the list",
  robots: { index: false },
};

export default function Thanks() {
  return (
    <main id="main" className="grain relative flex min-h-screen flex-col items-center justify-center bg-ink px-4 text-center text-white">
      <Link href="/" aria-label="Okwan home">
        <Logo />
      </Link>
      <h1 className="font-display mt-10 text-[clamp(2.6rem,7vw,5rem)]">
        You&rsquo;re on the list. <em className="text-gold">Akwaaba.</em>
      </h1>
      <p className="mt-5 max-w-md text-lg text-white/65">
        We&rsquo;ll message you on WhatsApp the day your free mock is ready.
      </p>
      <Link href="/" className="mt-10 rounded-full border border-white/20 px-5 py-2.5 text-sm hover:border-gold hover:text-gold">
        Back to Okwan
      </Link>
    </main>
  );
}
