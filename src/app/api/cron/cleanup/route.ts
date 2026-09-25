import { timingSafeEqual } from "node:crypto";
import { features } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Daily: deletes documents past their `delete_after` date (default 30 days),
 * both the stored file and the row. Vercel Cron calls this with CRON_SECRET.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!features.supabaseAdmin) return new Response("Not configured", { status: 503 });

  const db = createServiceClient();
  let deleted = 0;
  for (;;) {
    const { data: expired } = await db
      .from("documents")
      .select("id, storage_path")
      .lt("delete_after", new Date().toISOString())
      .limit(100);
    if (!expired?.length) break;
    await db.storage.from("documents").remove(expired.map((d) => d.storage_path));
    await db.from("documents").delete().in("id", expired.map((d) => d.id));
    deleted += expired.length;
    if (expired.length < 100) break;
  }
  return Response.json({ deleted });
}
