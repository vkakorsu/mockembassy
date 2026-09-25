import "server-only";
import { env } from "@/lib/env";

/**
 * Minimal Supabase REST insert using the service role key (server only).
 * Returns false when Supabase isn't configured, so callers can fail loudly
 * instead of silently dropping data.
 */
export async function insertRow(table: string, row: Record<string, unknown>): Promise<"ok" | "not_configured" | "error"> {
  const url = env.supabaseUrl;
  const key = env.supabaseSecretKey;
  if (!url || !key) return "not_configured";
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal,resolution=ignore-duplicates",
    },
    body: JSON.stringify(row),
  });
  return res.ok ? "ok" : "error";
}
