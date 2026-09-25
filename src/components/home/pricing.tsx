import { formatGhs, LAUNCH_PRICE_GHS, LAUNCH_PRICE_LIMIT, plans, type Plan } from "@/lib/pricing";

function PlanCard({ p }: { p: Plan }) {
  const dark = p.featured;
  return (
    <li
      className={`reveal flex flex-col rounded-3xl border p-7 ${
        dark ? "border-ink bg-ink text-white shadow-2xl lg:-my-4 lg:py-11" : "border-line bg-raised"
      }`}
    >
      <p className={`text-sm ${dark ? "text-gold" : "text-muted"}`}>{p.name}</p>
      <p className="font-display mt-3 text-6xl tabular">{formatGhs(p.priceGhs)}</p>
      <p className={`mt-1 text-xs ${dark ? "text-white/55" : "text-muted"}`}>{p.cadence}</p>
      <p className={`mt-5 leading-relaxed ${dark ? "text-white/80" : "text-fg"}`}>{p.summary}</p>
      <ul className={`mt-5 space-y-2 text-sm ${dark ? "text-white/75" : "text-muted"}`}>
        {p.features.map((f) => (
          <li key={f} className="flex gap-2">
            <span aria-hidden className={dark ? "text-gold" : "text-accent"}>
              ✓
            </span>
            {f}
          </li>
        ))}
      </ul>
      {dark && (
        <p className="mt-auto pt-7 text-xs text-gold">
          Launch price {formatGhs(LAUNCH_PRICE_GHS)} for the first {LAUNCH_PRICE_LIMIT.toLocaleString()} passes.
        </p>
      )}
    </li>
  );
}

export function Pricing() {
  const core = plans.filter((p) => ["free", "sprint", "pass"].includes(p.id));
  const human = plans.filter((p) => ["coach", "senior"].includes(p.id));
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-8 border-b border-line">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-28">
        <p className="text-sm uppercase tracking-[0.2em] text-accent">Pricing</p>
        <div className="mt-3 grid gap-6 lg:grid-cols-2 lg:items-end">
          <h2 id="pricing-title" className="font-display text-[clamp(2.2rem,4.6vw,3.8rem)]">
            Pay once per interview. <em className="text-muted">Never per minute.</em>
          </h2>
          <p className="text-lg leading-relaxed text-muted">
            Prices include VAT. Pay with MTN MoMo, Telecel Cash, AirtelTigo Money or card. No subscriptions, no
            auto-renewals. Refunds within 7 days.
          </p>
        </div>
        <ul className="mt-14 grid gap-5 md:grid-cols-3">
          {core.map((p) => (
            <PlanCard key={p.id} p={p} />
          ))}
        </ul>
        <h3 className="font-display mt-20 text-3xl">Add a human expert</h3>
        <ul className="mt-6 grid gap-5 md:grid-cols-2">
          {human.map((p) => (
            <PlanCard key={p.id} p={p} />
          ))}
        </ul>
        <p className="mt-10 text-sm text-muted">
          Agencies, schools and churches: seat packs from GH₵199 per applicant, with a counsellor dashboard.
        </p>
      </div>
    </section>
  );
}
