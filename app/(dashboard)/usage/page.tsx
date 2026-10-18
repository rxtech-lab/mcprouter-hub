import { Activity, Coins, Gauge } from "lucide-react";
import { z } from "zod";
import { DailyBarChart, HorizontalBars } from "@/components/charts";
import { ButtonLink } from "@/components/m3/button";
import { Card, CardTitle, StatCard } from "@/components/m3/card";
import { EmptyState } from "@/components/m3/page-header";
import { requirePageUser } from "@/lib/auth";
import { billingConfig } from "@/lib/billing/config";
import { getEntitlements, subscriptionConfigured } from "@/lib/billing/subscription";
import { formatDateTime, formatNumber } from "@/lib/format";
import { callsByTool, callsPerDay } from "@/lib/usage";

export const metadata = { title: "Usage" };

const RANGES = [7, 14, 30];

const paramsSchema = z.object({ days: z.enum(["7", "14", "30"]).catch("30").transform(Number) });

export default async function UsageCallsPage({ searchParams }: PageProps<"/usage">) {
  const user = await requirePageUser();
  if (!subscriptionConfigured) {
    return <EmptyState title="Billing is not configured">Set RX_SUBSCRIPTION_URL and RX_SUBSCRIPTION_API_KEY to show usage.</EmptyState>;
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
        <StatCard label={`Calls, last ${days} days`} value={daily ? formatNumber(total) : "–"} icon={<Activity size={18} />} />
        <StatCard
          label="Plan allowance"
          value={allowance ? `${formatNumber(allowance.used)} / ${allowance.limit === null ? "∞" : formatNumber(allowance.limit)}` : "–"}
          detail={allowance?.resetsAt ? `Resets ${formatDateTime(allowance.resetsAt)}` : undefined}
          icon={<Gauge size={18} />}
        />
        <StatCard label={`Credits spent, last ${days} days`} value={daily ? formatNumber(credits) : "–"} detail="Calls past the allowance" icon={<Coins size={18} />} />
      </div>

      <Card className="mt-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Calls per day</CardTitle>
            <p className="type-body-small text-on-surface-variant">Hong Kong time</p>
          </div>
          <nav aria-label="Range" className="flex gap-1">
            {RANGES.map((range) => (
              <ButtonLink key={range} href={`/usage?days=${range}`} variant={range === days ? "tonal" : "text"} aria-current={range === days ? "true" : undefined}>
                {range} days
              </ButtonLink>
            ))}
          </nav>
        </div>
        {daily ? <DailyBarChart data={daily} label="Calls per day" /> : <p className="type-body-medium text-on-surface-variant">Usage is unavailable right now.</p>}
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>By tool</CardTitle>
          <p className="mb-4 type-body-small text-on-surface-variant">Last {days} days</p>
          {breakdown ? (
            <HorizontalBars
              rows={breakdown.byTool.map((row) => ({ label: row.tool, value: row.calls }))}
              empty="No tool calls in this range."
            />
          ) : (
            <p className="type-body-medium text-on-surface-variant">The breakdown is unavailable right now.</p>
          )}
        </Card>
        <Card>
          <CardTitle>By provider</CardTitle>
          <p className="mb-4 type-body-small text-on-surface-variant">Last {days} days</p>
          {breakdown ? (
            <HorizontalBars
              rows={breakdown.byProvider.map((row) => ({ label: row.title, detail: row.service, value: row.calls }))}
              empty="No tool calls in this range."
            />
          ) : (
            <p className="type-body-medium text-on-surface-variant">The breakdown is unavailable right now.</p>
          )}
        </Card>
      </div>
    </>
  );
}
