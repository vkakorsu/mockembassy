import type { Metadata } from "next";
import { TopBar } from "@/components/app/top-bar";
import { requireUser } from "@/lib/server/auth";
import { accountCredits } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: { default: "Your cases", template: "%s · Okwan" }, robots: { index: false } };

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const { user, supabase } = await requireUser();
  const credits = await accountCredits(supabase, user.id);
  return (
    <div className="min-h-screen">
      <TopBar credits={credits} />
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
