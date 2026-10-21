import type { Metadata } from "next";
import { Card, CardTitle } from "@/components/m3/card";
import { EmptyState, PageHeader } from "@/components/m3/page-header";
import { requirePageUser } from "@/lib/auth";
import { billingConfig } from "@/lib/billing/config";
import { activePlans, getCatalog, getEntitlements, subscriptionConfigured, type CatalogPlan, type CatalogTopup } from "@/lib/billing/subscription";
import { formatDateTime, formatNumber } from "@/lib/format";
import { price, interval } from "@/lib/billing/format";
import { getT } from "@/lib/i18n/server";
import { type Translator } from "@/lib/i18n/translate";
import { CheckoutNotice, PortalButton, ProductButton } from "./billing-buttons";
import { ButtonLink } from "@/components/m3/button";
import { planPurchaseMode } from "@/lib/billing/plan-change";
import { PlanChangeDialog } from "./plan-change-dialog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Billing") };
}

/** Why a top-up can't be bought yet, naming the plan it needs when there is one. */
function topupBlocker(topup: CatalogTopup, plans: CatalogPlan[], t: Translator) {
  const rule = topup.blockedBy?.[0];
  if (!rule) return t("Not available");
  const plan = plans.find((candidate) => candidate.id === rule.planId);
  if (rule.ruleType === "purchase_limit") return t("Purchase limit reached");
  return plan ? t("Requires {plan}", { plan: plan.name }) : t("Requires a paid plan");
}

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const user = await requirePageUser();
  const t = await getT();
  const params = await searchParams;
  const { checkout, changePlan } = params;

  if (!subscriptionConfigured) {
    return (
      <>
        <PageHeader title={t("Billing")} />
        <EmptyState title={t("Billing is not configured")}>{t("Set RX_SUBSCRIPTION_URL and RX_SUBSCRIPTION_API_KEY to show plans and usage.")}</EmptyState>
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
  const selected = catalog?.plans.find((plan) => plan.id === changePlan);
  const selectedMode = selected && entitlements && planPurchaseMode(selected, entitlements);
  const currentCatalogPlan = selectedMode?.kind === "change" && catalog?.plans.find((plan) => plan.id === selectedMode.current.planId);
  const monthlyPrice = (plan: CatalogPlan) => plan.priceAmountCents / ((plan.billingInterval === "year" ? 12 : plan.billingInterval === "quarter" ? 3 : 1) * (plan.intervalCount ?? 1));

  return (
    <>
      <CheckoutNotice status={typeof checkout === "string" ? checkout : undefined} />
      {selected && selectedMode?.kind === "change" ? <PlanChangeDialog key={selected.id}
        productId={selected.id}
        downgrade={!!currentCatalogPlan && monthlyPrice(selected) < monthlyPrice(currentCatalogPlan)}
        periodEnd={selectedMode.current.currentPeriodEnd}
        currentName={selectedMode.current.planName} targetName={selected.name}
        targetPrice={`${price(selected.priceAmountCents, selected.currency, t.locale)} ${interval(selected, t)}`} /> : null}
      <PageHeader
        title={t("Billing")}
        description={billingConfig.enabled ? t("Each MCP tool call counts as one call against your plan.") : t("Metering is switched off on this deployment, so tool calls are free for now.")}
        actions={<PortalButton />}
      />

      <Card variant="filled">
        <CardTitle>{t("Balance")}</CardTitle>
        {balances.length ? (
          <div className="mt-3 flex flex-col gap-1">
            {balances.map((balance) => (
              <p key={balance.unit} className="type-headline-medium tabular-nums">
                {formatNumber(balance.available, t.locale)} <span className="type-title-medium text-on-surface-variant">{balance.name}</span>
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-2 type-body-medium text-on-surface-variant">{entitlements ? t("No balance yet. Pick a plan or top up below.") : t("The balance is unavailable right now.")}</p>
        )}
        {usage ? (
          <p className="mt-3 type-body-small text-on-surface-variant">
            {t.plural("{n} call this period", "{n} calls this period", usage.used, { n: formatNumber(usage.used, t.locale) })}
            {usage.resetsAt ? ` · ${t("Resets {date}", { date: formatDateTime(usage.resetsAt, t.locale) })}` : ""}
          </p>
        ) : null}
      </Card>

      <h2 className="mt-8 mb-3 type-title-large">{t("Plans")}</h2>
      {catalog?.plans.length ? (
        <div className="stagger grid gap-4 md:grid-cols-3">
          {catalog.plans.map((plan) => {
            const mode = entitlements && planPurchaseMode(plan, entitlements);
            const next = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
              if (key === "checkout" || key === "changePlan" || key === "timing") continue;
              if (typeof value === "string") next.set(key, value);
              else value?.forEach((item) => next.append(key, item));
            }
            next.set("changePlan", plan.id);
            return (
            <Card key={plan.id} className="flex flex-col gap-2">
              <h3 className="type-title-medium">{plan.name}</h3>
              <p className="type-headline-small">{price(plan.priceAmountCents, plan.currency, t.locale)} <span className="type-body-medium text-on-surface-variant">{interval(plan, t)}</span></p>
              {plan.description ? <p className="flex-1 type-body-medium text-on-surface-variant">{plan.description}</p> : <span className="flex-1" />}
              {mode?.kind === "change" ? <ButtonLink href={`/billing?${next}`} scroll={false}>{t("Change plan")}</ButtonLink> : <ProductButton
                kind="plan"
                productId={plan.id}
                current={currentPlans.has(plan.key) || currentPlans.has(plan.id)}
                // Free tiers are assigned by rx-subscription and can't go through checkout.
                disabled={!entitlements || plan.autoSubscribe || (mode?.kind === "unsupported" || mode?.kind === "pending")}
                label={mode?.kind === "pending" ? t("Plan change scheduled") : mode?.kind === "unsupported" ? t("Plan change unavailable") : plan.autoSubscribe ? t("Included when you have no plan") : plan.trialDays ? t("Start {days}-day trial", { days: plan.trialDays }) : t("Choose plan")}
              />}
              {mode?.kind === "pending" ? <p className="type-body-small text-on-surface-variant">{t("{plan} starts on {date}", { plan: mode.pending.planName, date: formatDateTime(mode.pending.effectiveAt, t.locale) })}</p> : null}
              {mode?.kind === "unsupported" ? <p className="type-body-small text-on-surface-variant">{t("This subscription cannot be changed here. Manage it with its billing provider or contact support.")}</p> : null}
            </Card>
          ); })}
        </div>
      ) : (
        <EmptyState title={t("No plans available")}>{catalog ? t("Plans will appear here once they're published.") : t("The plan catalogue couldn't be loaded.")}</EmptyState>
      )}

      {catalog?.topups.length ? (
        <>
          <h2 className="mt-8 mb-3 type-title-large">{t("Top-ups")}</h2>
          <div className="stagger grid gap-4 md:grid-cols-3">
            {catalog.topups.map((topup) => (
              <Card key={topup.id} className="flex flex-col gap-2">
                <h3 className="type-title-medium">{topup.name}</h3>
                <p className="type-headline-small">{price(topup.priceAmountCents, topup.currency, t.locale)}</p>
                <p className="flex-1 type-body-medium text-on-surface-variant">{topup.description ?? `${formatNumber(topup.amount, t.locale)} ${topup.unit ?? t("units")}`}</p>
                <ProductButton kind="topup" productId={topup.id} disabled={topup.eligible === false} label={topup.eligible === false ? topupBlocker(topup, catalog.plans, t) : t("Buy")} />
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
