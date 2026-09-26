import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { packLabel } from "@/lib/labels";
import { requireUser } from "@/lib/server/auth";
import { accountCredits } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: { default: "Your cases", template: "%s · Okwan" }, robots: { index: false } };

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const { user, supabase } = await requireUser();
  const credits = await accountCredits(supabase, user.id);
  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/app" aria-label="Your cases">
            <Logo />
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted sm:gap-4">
            <Link
              href={credits.buyHref}
              className="flex items-center gap-2 rounded-[3px] border border-line px-3 py-1.5 hover:border-ink hover:text-fg"
              title="Interviews and drills left"
            >
              <span className="hidden font-semibold text-fg sm:inline">{credits.plan ? packLabel(credits.plan) : "Free"}</span>
              <span className="tabular sm:hidden">{credits.interviews} left</span>
              <span className="hidden tabular sm:inline">
                {credits.interviews} interview{credits.interviews === 1 ? "" : "s"} · {credits.drills} drill{credits.drills === 1 ? "" : "s"}
              </span>
              <span className="hidden text-stamp md:inline">{credits.interviews || credits.drills ? "Get more" : "Get interviews"}</span>
            </Link>
            <span className="hidden lg:inline">{user.email}</span>
            <div className="flex items-center gap-2">
              <Link href="/app" className="rounded-[3px] border border-ink px-3 py-1.5 font-semibold text-fg hover:bg-ink hover:text-on-ink">
                Home
              </Link>
              <form action="/auth/signout" method="post">
                <button className="rounded-[3px] border border-line px-3 py-1.5 hover:text-fg">Sign out</button>
              </form>
            </div>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 py-10">
        {children}
      </main>
    </div>
  );
}
