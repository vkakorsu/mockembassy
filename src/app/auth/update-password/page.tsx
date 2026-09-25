import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/app/auth-forms";
import { AuthShell } from "@/components/app/auth-shell";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Reached from the reset email via /auth/callback, which signs the user in first. */
export default async function UpdatePassword() {
  await requireUser("/auth/update-password");
  return (
    <AuthShell title="New password">
      <UpdatePasswordForm url={env.supabaseUrl!} publishableKey={env.supabasePublishableKey!} />
    </AuthShell>
  );
}
