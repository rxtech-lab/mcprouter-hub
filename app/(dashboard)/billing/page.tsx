import type { Metadata } from "next";
import { Card, CardTitle } from "@/components/m3/card";
import { EmptyState, PageHeader } from "@/components/m3/page-header";
import { requirePageUser } from "@/lib/auth";
import { billingConfig } from "@/lib/billing/config";
import { activePlans, getCatalog, getEntitlements, subscriptionConfigured, type CatalogPlan, type CatalogTopup } from "@/lib/billing/subscription";
import { formatDateTime, formatNumber } from "@/lib/format";
import { INTL_LOCALES, type Locale } from "@/lib/i18n/config";
import { getT } from "@/lib/i18n/server";
import { msg, type Translator } from "@/lib/i18n/translate";
import { CheckoutNotice, PortalButton, ProductButton } from "./billing-buttons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Billing") };
}

function price(cents: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(INTL_LOCALES[locale], { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

/** Why a top-up can't be bought yet, naming the plan it needs when there is one. */
function topupBlocker(topup: CatalogTopup, plans: CatalogPlan[], t: Translator) {
  const rule = topup.blockedBy?.[0];
  if (!rule) return t("Not available");
  const plan = plans.find((candidate) => candidate.id === rule.planId);
  if (rule.ruleType === "purchase_limit") return t("Purchase limit reached");
  return plan ? t("Requires {plan}", { plan: plan.name }) : t("Requires a paid plan");
}

/** Known billing intervals get their own phrase; anything else falls back to the generic one. */
const PER_INTERVAL: Record<string, string> = { day: msg("per day"), week: msg("per week"), month: msg("per month"), year: msg("per year") };
const EVERY_INTERVAL: Record<string, string> = {
  day: msg("every {count} days"),
  week: msg("every {count} weeks"),
  month: msg("every {count} months"),
  year: msg("every {count} years"),
};

function interval(plan: { billingInterval: string | null; intervalCount: number | null }, t: Translator) {
  if (!plan.billingInterval) return t("one-off");
  if (plan.intervalCount && plan.intervalCount > 1) {
    const every = EVERY_INTERVAL[plan.billingInterval];
    return every ? t(every, { count: plan.intervalCount }) : t("every {count} {interval}s", { count: plan.intervalCount, interval: plan.billingInterval });
  }
  const per = PER_INTERVAL[plan.billingInterval];
  return per ? t(per) : t("per {interval}", { interval: plan.billingInterval });
}

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const user = await requirePageUser();
  const t = await getT();
  const { checkout } = await searchParams;

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

  return (
    <>
      <CheckoutNotice status={typeof checkout === "string" ? checkout : undefined} />
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
          {catalog.plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col gap-2">
              <h3 className="type-title-medium">{plan.name}</h3>
              <p className="type-headline-small">{price(plan.priceAmountCents, plan.currency, t.locale)} <span className="type-body-medium text-on-surface-variant">{interval(plan, t)}</span></p>
              {plan.description ? <p className="flex-1 type-body-medium text-on-surface-variant">{plan.description}</p> : <span className="flex-1" />}
              <ProductButton
                kind="plan"
                productId={plan.id}
                current={currentPlans.has(plan.key) || currentPlans.has(plan.id)}
                // Free tiers are assigned by rx-subscription and can't go through checkout.
                disabled={plan.autoSubscribe}
                label={plan.autoSubscribe ? t("Included when you have no plan") : plan.trialDays ? t("Start {days}-day trial", { days: plan.trialDays }) : t("Choose plan")}
              />
            </Card>
          ))}
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
