import { Activity, AlertTriangle, Timer } from "lucide-react";
import { notFound } from "next/navigation";
import { DailyBarChart, HorizontalBars } from "@/components/charts";
import { ButtonLink } from "@/components/m3/button";
import { Card, CardTitle, StatCard } from "@/components/m3/card";
import { Badge } from "@/components/m3/chip";
import { BackLink } from "@/app/sources/back-link";
import { requirePageUser } from "@/lib/auth";
import { formatNumber, formatRelative } from "@/lib/format";
import { callsByTool, clientUsage, parseClientId } from "@/lib/usage";
import { CLIENT_KIND_LABELS, ClientIcon } from "../client-icon";
import { clientHref, daysSchema, firstParam, RANGES } from "../params";

export const metadata = { title: "Client usage" };

export default async function UsageClientPage({ params, searchParams }: PageProps<"/usage/clients/[client]">) {
  const user = await requirePageUser();
  const client = parseClientId(decodeURIComponent((await params).client));
  if (!client) notFound();
  const days = daysSchema.parse(firstParam((await searchParams).days));

  const [detail, breakdown] = await Promise.all([
    clientUsage(user, client, days).catch((error) => (console.error("[usage] client", error), null)),
    callsByTool(user, days, client).catch((error) => (console.error("[usage] client breakdown", error), null)),
  ]);

  return (
    <>
      <BackLink href={`/usage/clients?days=${days}`}>All clients</BackLink>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
          <ClientIcon kind={detail?.kind ?? "agent"} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate type-title-large">{detail?.label ?? "Client"}</h2>
          <p className="type-body-small text-on-surface-variant">{detail?.lastCallAt ? `Last call ${formatRelative(detail.lastCallAt)}` : `No calls in the last ${days} days`}</p>
        </div>
        {detail ? <Badge>{CLIENT_KIND_LABELS[detail.kind]}</Badge> : null}
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-3">
        <StatCard label={`Calls, last ${days} days`} value={detail ? formatNumber(detail.calls) : "–"} icon={<Activity size={18} />} />
        <StatCard label="Failed or denied" value={detail ? formatNumber(detail.errors) : "–"} detail="Errors and calls refused by billing" icon={<AlertTriangle size={18} />} />
        <StatCard label="Average latency" value={detail?.averageLatencyMs != null ? `${formatNumber(detail.averageLatencyMs)} ms` : "–"} icon={<Timer size={18} />} />
      </div>

      <Card className="mt-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Calls per day</CardTitle>
            <p className="type-body-small text-on-surface-variant">Hong Kong time</p>
          </div>
          <nav aria-label="Range" className="flex gap-1">
            {RANGES.map((range) => (
              <ButtonLink key={range} href={clientHref(client, range)} variant={range === days ? "tonal" : "text"} aria-current={range === days ? "true" : undefined}>
                {range} days
              </ButtonLink>
            ))}
          </nav>
        </div>
        {detail ? <DailyBarChart data={detail.daily} label="Calls per day" /> : <p className="type-body-medium text-on-surface-variant">Usage is unavailable right now.</p>}
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>By tool</CardTitle>
          <p className="mb-4 type-body-small text-on-surface-variant">Last {days} days</p>
          {breakdown ? (
            <HorizontalBars rows={breakdown.byTool.map((row) => ({ label: row.tool, value: row.calls }))} empty="No tool calls in this range." />
          ) : (
            <p className="type-body-medium text-on-surface-variant">The breakdown is unavailable right now.</p>
          )}
        </Card>
        <Card>
          <CardTitle>By provider</CardTitle>
          <p className="mb-4 type-body-small text-on-surface-variant">Last {days} days</p>
          {breakdown ? (
            <HorizontalBars rows={breakdown.byProvider.map((row) => ({ label: row.title, detail: row.service, value: row.calls }))} empty="No tool calls in this range." />
          ) : (
            <p className="type-body-medium text-on-surface-variant">The breakdown is unavailable right now.</p>
          )}
        </Card>
      </div>
    </>
  );
}
