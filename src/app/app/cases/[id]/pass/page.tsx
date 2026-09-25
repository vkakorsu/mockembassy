import { notFound } from "next/navigation";
import { buyPlan } from "@/app/app/actions";
import { BackLink, Button, Card, PageTitle } from "@/components/app/ui";
import { features } from "@/lib/env";
import { formatGhs, plans } from "@/lib/pricing";
import { requireUser } from "@/lib/server/auth";
import { PURCHASABLE, priceFor } from "@/lib/server/paystack";
import { getCase } from "@/lib/server/repo";
import { createServiceClient } from "@/lib/supabase/server";
import type { PlanId } from "@/lib/domain/entitlement";

export default async function PassPage(props: PageProps<"/app/cases/[id]/pass">) {
  const { id } = await props.params;
  const { reason } = await props.searchParams;
  const { supabase } = await requireUser(`/app/cases/${id}/pass`);
  const caseRow = await getCase(supabase, id);
  if (!caseRow) notFound();
  const purchasable = plans.filter((p) => PURCHASABLE.includes(p.id as PlanId));
  const prices = features.supabaseAdmin
    ? await Promise.all(purchasable.map((p) => priceFor(createServiceClient(), p.id as PlanId)))
    : purchasable.map((p) => p.priceGhs * 100);

  return (
    <>
      <BackLink href={`/app/cases/${id}`}>{caseRow.applicant_name}</BackLink>
      <PageTitle eyebrow="Passes" title="Practise until the day">
        {typeof reason === "string" ? reason : "One payment per interview. MoMo or card. VAT included. Refunds within 7 days."}
      </PageTitle>
      {!features.paystack && (
        <p className="mb-6 rounded-[4px] border border-line p-4 text-sm text-muted">Payments aren&rsquo;t configured yet (PAYSTACK_SECRET_KEY).</p>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {purchasable.map((p, i) => (
          <Card key={p.id} className={p.featured ? "border-ink" : ""}>
            <p className="text-sm text-muted">{p.name}</p>
            <p className="font-display mt-2 text-5xl tabular">{formatGhs(prices[i] / 100)}</p>
            {p.id === "pass" && prices[i] / 100 < p.priceGhs && <p className="mt-1 text-xs text-accent">Launch price (normally {formatGhs(p.priceGhs)})</p>}
            <p className="mt-3 text-sm">{p.summary}</p>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {p.features.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
            <form action={buyPlan.bind(null, id, p.id as PlanId)} className="mt-5">
              <Button disabled={!features.paystack}>Pay with MoMo or card</Button>
            </form>
          </Card>
        ))}
      </div>
    </>
  );
}
