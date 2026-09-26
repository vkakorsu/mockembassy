"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

/**
 * Header account links. The homepage is static, so the signed-in state is read
 * from the auth cookie in the browser (no network call needed to decide).
 */
export function AuthNav({ url, publishableKey }: { url: string; publishableKey: string }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient(url, publishableKey);
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, [url, publishableKey]);

  // Reserve space while we check, so the header doesn't jump.
  if (signedIn === null) return <div className="h-9 w-40" aria-hidden />;

  if (signedIn) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <form action="/auth/signout" method="post" className="hidden sm:block">
          <button className="underline-offset-4 hover:underline">Sign out</button>
        </form>
        <Link href="/app" className="rounded-[3px] bg-ink px-4 py-2 font-semibold text-on-ink hover:bg-stamp">
          My cases
        </Link>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4 text-sm">
      <Link href="/login" className="hidden underline-offset-4 hover:underline sm:inline">
        Sign in
      </Link>
      <Link href="/signup" className="rounded-[3px] bg-ink px-4 py-2 font-semibold text-on-ink hover:bg-stamp">
        Create account
      </Link>
    </div>
  );
}
