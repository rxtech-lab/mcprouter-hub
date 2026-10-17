import { Card, CardTitle } from "@/components/m3/card";
import { EmptyState, PageHeader } from "@/components/m3/page-header";
import { requirePageUser } from "@/lib/auth";
import { billingConfig } from "@/lib/billing/config";
import { activePlans, getCatalog, getEntitlements, subscriptionConfigured, type CatalogPlan, type CatalogTopup } from "@/lib/billing/subscription";
import { formatDateTime, formatNumber } from "@/lib/format";
import { CheckoutNotice, PortalButton, ProductButton } from "./billing-buttons";

export const metadata = { title: "Billing" };

function price(cents: number, currency: string) {
  return new Intl.NumberFormat("en-HK", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

/** Why a top-up can't be bought yet, naming the plan it needs when there is one. */
function topupBlocker(topup: CatalogTopup, plans: CatalogPlan[]) {
  const rule = topup.blockedBy?.[0];
  if (!rule) return "Not available";
  const plan = plans.find((candidate) => candidate.id === rule.planId);
  if (rule.ruleType === "purchase_limit") return "Purchase limit reached";
  return plan ? `Requires ${plan.name}` : "Requires a paid plan";
}

function interval(plan: { billingInterval: string | null; intervalCount: number | null }) {
  if (!plan.billingInterval) return "one-off";
  return plan.intervalCount && plan.intervalCount > 1 ? `every ${plan.intervalCount} ${plan.billingInterval}s` : `per ${plan.billingInterval}`;
}

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const user = await requirePageUser();
  const { checkout } = await searchParams;

  if (!subscriptionConfigured) {
    return (
      <>
        <PageHeader title="Billing" />
        <EmptyState title="Billing is not configured">Set RX_SUBSCRIPTION_URL and RX_SUBSCRIPTION_API_KEY to show plans and usage.</EmptyState>
      </>
    );
  }

  const [entitlements, catalog] = await Promise.all([
    getEntitlements(user).catch((error) => (console.error("[billing] entitlements", error), null)),
    getCatalog(user).catch((error) => (console.error("[billing] catalog", error), null)),
  ]);
  const usage = entitlements?.usage.find((item) => item.key === billingConfig.usageItem);
  const currentPlans = new Set(entitlements ? activePlans(entitlements).flatMap((plan) => [plan.planKey, plan.planId]) : []);
  const balances = (entitlements?.balances ?? []).filter((balance) => !billingConfig.creditUnit || balance.unit === billingConfig.creditUnit);

  return (
    <>
      <CheckoutNotice status={typeof checkout === "string" ? checkout : undefined} />
      <PageHeader
        title="Billing"
        description={billingConfig.enabled ? "Each MCP tool call counts as one call against your plan." : "Metering is switched off on this deployment, so tool calls are free for now."}
        actions={<PortalButton />}
      />

      <Card variant="filled">
        <CardTitle>Balance</CardTitle>
        {balances.length ? (
          <div className="mt-3 flex flex-col gap-1">
            {balances.map((balance) => (
              <p key={balance.unit} className="type-headline-medium tabular-nums">
                {formatNumber(balance.available)} <span className="type-title-medium text-on-surface-variant">{balance.name}</span>
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-2 type-body-medium text-on-surface-variant">{entitlements ? "No balance yet. Pick a plan or top up below." : "The balance is unavailable right now."}</p>
        )}
        {usage ? (
          <p className="mt-3 type-body-small text-on-surface-variant">
            {formatNumber(usage.used)} {usage.used === 1 ? "call" : "calls"} this period{usage.resetsAt ? ` · Resets ${formatDateTime(usage.resetsAt)}` : ""}
          </p>
        ) : null}
      </Card>

      <h2 className="mt-8 mb-3 type-title-large">Plans</h2>
      {catalog?.plans.length ? (
        <div className="grid gap-4 md:grid-cols-3">
          {catalog.plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col gap-2">
              <h3 className="type-title-medium">{plan.name}</h3>
              <p className="type-headline-small">{price(plan.priceAmountCents, plan.currency)} <span className="type-body-medium text-on-surface-variant">{interval(plan)}</span></p>
              {plan.description ? <p className="flex-1 type-body-medium text-on-surface-variant">{plan.description}</p> : <span className="flex-1" />}
              <ProductButton
                kind="plan"
                productId={plan.id}
                current={currentPlans.has(plan.key) || currentPlans.has(plan.id)}
                // Free tiers are assigned by rx-subscription and can't go through checkout.
                disabled={plan.autoSubscribe}
                label={plan.autoSubscribe ? "Included when you have no plan" : plan.trialDays ? `Start ${plan.trialDays}-day trial` : "Choose plan"}
              />
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No plans available">{catalog ? "Plans will appear here once they're published." : "The plan catalogue couldn't be loaded."}</EmptyState>
      )}

      {catalog?.topups.length ? (
        <>
          <h2 className="mt-8 mb-3 type-title-large">Top-ups</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {catalog.topups.map((topup) => (
              <Card key={topup.id} className="flex flex-col gap-2">
                <h3 className="type-title-medium">{topup.name}</h3>
                <p className="type-headline-small">{price(topup.priceAmountCents, topup.currency)}</p>
                <p className="flex-1 type-body-medium text-on-surface-variant">{topup.description ?? `${formatNumber(topup.amount)} ${topup.unit ?? "units"}`}</p>
                <ProductButton kind="topup" productId={topup.id} disabled={topup.eligible === false} label={topup.eligible === false ? topupBlocker(topup, catalog.plans) : "Buy"} />
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
