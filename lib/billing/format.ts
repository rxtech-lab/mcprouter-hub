import { INTL_LOCALES, type Locale } from "@/lib/i18n/config";
import { msg, type Translator } from "@/lib/i18n/translate";

export function price(cents: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(INTL_LOCALES[locale], { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

/** Known billing intervals get their own phrase; anything else falls back to the generic one. */
const PER_INTERVAL: Record<string, string> = { day: msg("per day"), week: msg("per week"), month: msg("per month"), year: msg("per year") };
const EVERY_INTERVAL: Record<string, string> = {
  day: msg("every {count} days"),
  week: msg("every {count} weeks"),
  month: msg("every {count} months"),
  year: msg("every {count} years"),
};

export function interval(plan: { billingInterval: string | null; intervalCount: number | null }, t: Translator) {
  if (!plan.billingInterval) return t("one-off");
  if (plan.intervalCount && plan.intervalCount > 1) {
    const every = EVERY_INTERVAL[plan.billingInterval];
    return every ? t(every, { count: plan.intervalCount }) : t("every {count} {interval}s", { count: plan.intervalCount, interval: plan.billingInterval });
  }
  const per = PER_INTERVAL[plan.billingInterval];
  return per ? t(per) : t("per {interval}", { interval: plan.billingInterval });
}

