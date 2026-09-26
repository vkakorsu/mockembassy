import { PageHead, Table } from "@/components/admin/stat";
import { env, features } from "@/lib/env";
import { requireAdmin } from "@/lib/server/admin";
import { geminiHealth, type HealthCheck } from "@/lib/server/gemini";

export const metadata = { title: "System health" };

async function supabaseCheck(db: Awaited<ReturnType<typeof requireAdmin>>["db"]): Promise<HealthCheck> {
  const t = Date.now();
  const { error } = await db.from("profiles").select("id", { head: true, count: "exact" });
  return { name: "Supabase (service key)", ok: !error, detail: error?.message ?? "reads OK", ms: Date.now() - t };
}

export default async function AdminHealth() {
  const { db } = await requireAdmin();
  const checks: HealthCheck[] = [
    await supabaseCheck(db),
    { name: "Paystack key", ok: features.paystack, detail: features.paystack ? "set" : "PAYSTACK_SECRET_KEY not set", ms: 0 },
  ];
  let liveModels: string[] = [];
  let flashModels: string[] = [];
  if (features.gemini) {
    const g = await geminiHealth();
    checks.push(...g.checks);
    liveModels = g.liveModels;
    flashModels = g.flashModels;
  } else {
    checks.push({ name: "Gemini key", ok: false, detail: "GEMINI_API_KEY not set", ms: 0 });
  }

  return (
    <>
      <PageHead title="System health">
        Live checks against the configured keys. Models in use: <code className="font-mono">{env.geminiLiveModel}</code> (interview) and{" "}
        <code className="font-mono">{env.geminiFlashModel}</code> (extraction and grading). Override with GEMINI_LIVE_MODEL / GEMINI_FLASH_MODEL.
      </PageHead>
      <div className="mt-8" data-testid="health">
        <Table
          head={["Check", "Result", "Detail", "Time"]}
          rows={checks.map((c) => [
            c.name,
            <span key="r" className={c.ok ? "text-stamp" : "text-refused"}>{c.ok ? "OK" : "FAIL"}</span>,
            <span key="d" className="font-mono text-xs break-all">{c.detail}</span>,
            c.ms ? `${c.ms} ms` : "—",
          ])}
          empty="No checks."
        />
      </div>
      {(liveModels.length > 0 || flashModels.length > 0) && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 font-mono text-xs">
          <div>
            <h2 className="mb-2 text-sm uppercase tracking-[0.18em]">Live models this key can use</h2>
            <ul data-testid="live-models">{liveModels.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
          <div>
            <h2 className="mb-2 text-sm uppercase tracking-[0.18em]">Flash models</h2>
            <ul data-testid="flash-models">{flashModels.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        </div>
      )}
    </>
  );
}
