import { ArrowRight, Check, Coins } from "lucide-react";
import { ButtonLink } from "@/components/m3/button";
import { billingConfig } from "@/lib/billing/config";
import { getCatalog, subscriptionConfigured } from "@/lib/billing/subscription";
import { price, interval } from "@/lib/billing/format";
import { getT } from "@/lib/i18n/server";

export async function LandingPricing() {
  const t = await getT();
  const catalog = subscriptionConfigured ? await getCatalog().catch((error) => {
    console.error("[pricing] catalogue unavailable", error);
    return null;
  }) : null;

  return (
    <section id="pricing" className="scroll-mt-24" aria-labelledby="pricing-title">
      <div className="mb-8 flex flex-col gap-2">
        <span className="type-label-large text-primary">{t("Pricing")}</span>
        <h2 id="pricing-title" className="type-headline-large">{t("A plan for every assistant")}</h2>
        <p className="max-w-2xl type-body-large text-on-surface-variant">
          {billingConfig.enabled ? t("Each MCP tool call counts as one call against your plan.") : t("Metering is switched off on this deployment, so tool calls are free for now.")}
        </p>
      </div>
      {catalog?.plans.length ? (
        <ul className="stagger grid gap-4 md:grid-cols-3">
          {catalog.plans.map((plan) => (
            <li key={plan.id} className="flex flex-col gap-5 rounded-xl border border-outline-variant bg-surface-container-low p-6 transition-[box-shadow,translate] duration-300 ease-emphasized hover:-translate-y-1 hover:shadow-elevation-2">
              <h3 className="type-title-large">{plan.name}</h3>
              <p className="type-display-small">{price(plan.priceAmountCents, plan.currency, t.locale)} <span className="type-body-medium text-on-surface-variant">{interval(plan, t)}</span></p>
              {plan.description ? <p className="type-body-large text-on-surface-variant">{plan.description}</p> : null}
              <p className="flex items-center gap-2 type-body-medium"><Check size={18} aria-hidden className="shrink-0 text-primary" />{t("One MCP endpoint for every client.")}</p>
              {plan.trialDays ? <p className="type-label-large text-primary">{t("Start {days}-day trial", { days: plan.trialDays })}</p> : null}
              <ButtonLink href="/billing" variant={plan.autoSubscribe ? "tonal" : "filled"} className="mt-auto" data-analytics-event="select_plan" data-analytics-label={plan.key}>
                {plan.autoSubscribe ? t("Get started") : t("Choose plan")} <ArrowRight size={18} />
              </ButtonLink>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-4 rounded-xl bg-secondary-container p-8 text-on-secondary-container">
          <Coins size={32} aria-hidden />
          <h3 className="type-headline-small">{billingConfig.enabled ? t("Find your plan") : t("Free for now")}</h3>
          <p className="max-w-2xl type-body-large">{t("See current plans, credits and top-ups on the billing page.")}</p>
          <ButtonLink href="/billing" data-analytics-event="pricing_click" data-analytics-label="view_plans">{t("View plans")} <ArrowRight size={18} /></ButtonLink>
        </div>
      )}
      {catalog?.topups.length ? <p className="mt-5 type-body-medium text-on-surface-variant">{t("Need more calls? Explore top-ups on the billing page.")}</p> : null}
    </section>
  );
}
