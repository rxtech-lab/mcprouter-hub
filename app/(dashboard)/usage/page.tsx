import { Activity, Coins, Gauge } from "lucide-react";
import type { Metadata } from "next";
import { z } from "zod";
import { DailyBarChart, HorizontalBars } from "@/components/charts";
import { ButtonLink } from "@/components/m3/button";
import { Card, CardTitle, StatCard } from "@/components/m3/card";
import { EmptyState } from "@/components/m3/page-header";
import { requirePageUser } from "@/lib/auth";
import { billingConfig } from "@/lib/billing/config";
import { getEntitlements, subscriptionConfigured } from "@/lib/billing/subscription";
import { formatDateTime, formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { callsByTool, callsPerDay } from "@/lib/usage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Usage") };
}

const RANGES = [7, 14, 30];

const paramsSchema = z.object({ days: z.enum(["7", "14", "30"]).catch("30").transform(Number) });

export default async function UsageCallsPage({ searchParams }: PageProps<"/usage">) {
  const user = await requirePageUser();
  const t = await getT();
  if (!subscriptionConfigured) {
    return <EmptyState title={t("Billing is not configured")}>{t("Set RX_SUBSCRIPTION_URL and RX_SUBSCRIPTION_API_KEY to show usage.")}</EmptyState>;
  }

  const raw = await searchParams;
  const { days } = paramsSchema.parse({ days: Array.isArray(raw.days) ? raw.days[0] : raw.days });
  const [daily, entitlements, breakdown] = await Promise.all([
    callsPerDay(user, days).catch((error) => (console.error("[usage] statistics", error), null)),
    getEntitlements(user).catch((error) => (console.error("[usage] entitlements", error), null)),
    callsByTool(user, days).catch((error) => (console.error("[usage] breakdown", error), null)),
  ]);
  const allowance = entitlements?.usage.find((item) => item.key === billingConfig.usageItem);
  const total = daily?.reduce((sum, row) => sum + row.value, 0) ?? 0;
  const credits = daily?.reduce((sum, row) => sum + row.credits, 0) ?? 0;

  return (
    <>
      <div className="stagger grid gap-4 sm:grid-cols-3">
        <StatCard label={t("Calls, last {days} days", { days })} value={daily ? formatNumber(total, t.locale) : "–"} icon={<Activity size={18} />} />
        <StatCard
          label={t("Plan allowance")}
          value={allowance ? `${formatNumber(allowance.used, t.locale)} / ${allowance.limit === null ? "∞" : formatNumber(allowance.limit, t.locale)}` : "–"}
          detail={allowance?.resetsAt ? t("Resets {date}", { date: formatDateTime(allowance.resetsAt, t.locale) }) : undefined}
          icon={<Gauge size={18} />}
        />
        <StatCard label={t("Credits spent, last {days} days", { days })} value={daily ? formatNumber(credits, t.locale) : "–"} detail={t("Calls past the allowance")} icon={<Coins size={18} />} />
      </div>

      <Card className="mt-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>{t("Calls per day")}</CardTitle>
            <p className="type-body-small text-on-surface-variant">{t("Hong Kong time")}</p>
          </div>
          <nav aria-label={t("Range")} className="flex gap-1">
            {RANGES.map((range) => (
              <ButtonLink key={range} href={`/usage?days=${range}`} variant={range === days ? "tonal" : "text"} aria-current={range === days ? "true" : undefined}>
                {t("{range} days", { range })}
              </ButtonLink>
            ))}
          </nav>
        </div>
        {daily ? <DailyBarChart data={daily} label={t("Calls per day")} /> : <p className="type-body-medium text-on-surface-variant">{t("Usage is unavailable right now.")}</p>}
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>{t("By tool")}</CardTitle>
          <p className="mb-4 type-body-small text-on-surface-variant">{t("Last {days} days", { days })}</p>
          {breakdown ? (
            <HorizontalBars
              rows={breakdown.byTool.map((row) => ({ label: row.tool, value: row.calls }))}
              empty={t("No tool calls in this range.")}
            />
          ) : (
            <p className="type-body-medium text-on-surface-variant">{t("The breakdown is unavailable right now.")}</p>
          )}
        </Card>
        <Card>
          <CardTitle>{t("By provider")}</CardTitle>
          <p className="mb-4 type-body-small text-on-surface-variant">{t("Last {days} days", { days })}</p>
          {breakdown ? (
            <HorizontalBars
              rows={breakdown.byProvider.map((row) => ({ label: row.title, detail: row.service, value: row.calls }))}
              empty={t("No tool calls in this range.")}
            />
          ) : (
            <p className="type-body-medium text-on-surface-variant">{t("The breakdown is unavailable right now.")}</p>
          )}
        </Card>
      </div>
    </>
  );
}
