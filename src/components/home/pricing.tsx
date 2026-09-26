import Link from "next/link";
import { formatGhs, plans, type Plan } from "@/lib/pricing";

function Row({ p }: { p: Plan }) {
  return (
    <li className={`grid gap-4 border-t border-ink py-7 lg:grid-cols-12 lg:items-start ${p.featured ? "bg-card lg:-mx-6 lg:px-6" : ""}`}>
      <div className="lg:col-span-3">
        <p className="text-xl font-semibold">{p.name}</p>
        <p className="label mt-1 text-muted">{p.priceGhs === 0 ? "no card needed" : "one payment"}</p>
        {p.featured && <span className="stamp mt-3 text-stamp">Recommended</span>}
      </div>
      <p className="font-display text-5xl tabular lg:col-span-2">{formatGhs(p.priceGhs)}</p>
      <div className="lg:col-span-7">
        <p className="leading-relaxed">{p.summary}</p>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
          {p.features.map((f) => (
            <li key={f}>— {f}</li>
          ))}
        </ul>
      </div>
    </li>
  );
}

export function Pricing() {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-4 border-b border-ink">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-28">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="label text-muted">Part 05 / 05 · Schedule of fees</p>
            <h2 id="pricing-title" className="font-display mt-3 text-[clamp(2.4rem,4.6vw,4rem)] uppercase">
              Pay for the practice you use. Nothing else.
            </h2>
          </div>
          <p className="leading-relaxed text-muted lg:col-span-4 lg:col-start-9">
            Prices include VAT. Pay with MTN MoMo, Telecel Cash, AirtelTigo Money or card. No subscriptions, no
            interview-date rules: an interview or drill is used only when you start it.
          </p>
        </div>
        <ul className="mt-12 border-b border-ink">
          {plans.map((p) => (
            <Row key={p.id} p={p} />
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted">Agencies, schools and churches: ask us about group pricing.</p>
          <Link href="/signup" className="rounded-[3px] bg-ink px-5 py-3 text-sm font-semibold text-on-ink hover:bg-stamp">
            Create a free account
          </Link>
        </div>
      </div>
    </section>
  );
}
