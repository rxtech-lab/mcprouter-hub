import { Activity, AlertTriangle, Timer } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DailyBarChart, HorizontalBars } from "@/components/charts";
import { ButtonLink } from "@/components/m3/button";
import { Card, CardTitle, StatCard } from "@/components/m3/card";
import { Badge } from "@/components/m3/chip";
import { BackLink } from "@/app/sources/back-link";
import { requirePageUser } from "@/lib/auth";
import { formatNumber, formatRelative } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { callsByTool, clientUsage, parseClientId } from "@/lib/usage";
import { CLIENT_KIND_LABELS, ClientIcon } from "../client-icon";
import { clientHref, daysSchema, firstParam, RANGES } from "../params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Client usage") };
}

export default async function UsageClientPage({ params, searchParams }: PageProps<"/usage/clients/[client]">) {
  const user = await requirePageUser();
  const t = await getT();
  const client = parseClientId(decodeURIComponent((await params).client));
  if (!client) notFound();
  const days = daysSchema.parse(firstParam((await searchParams).days));

  const [detail, breakdown] = await Promise.all([
    clientUsage(user, client, days).catch((error) => (console.error("[usage] client", error), null)),
    callsByTool(user, days, client).catch((error) => (console.error("[usage] client breakdown", error), null)),
  ]);

  return (
    <>
      <BackLink href={`/usage/clients?days=${days}`}>{t("All clients")}</BackLink>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
          <ClientIcon kind={detail?.kind ?? "agent"} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate type-title-large">{detail ? t(detail.label) : t("Client")}</h2>
          <p className="type-body-small text-on-surface-variant">{detail?.lastCallAt ? t("Last call {time}", { time: formatRelative(detail.lastCallAt, undefined, t.locale) }) : t("No calls in the last {days} days", { days })}</p>
        </div>
        {detail ? <Badge>{t(CLIENT_KIND_LABELS[detail.kind])}</Badge> : null}
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-3">
        <StatCard label={t("Calls, last {days} days", { days })} value={detail ? formatNumber(detail.calls, t.locale) : "–"} icon={<Activity size={18} />} />
        <StatCard label={t("Failed or denied")} value={detail ? formatNumber(detail.errors, t.locale) : "–"} detail={t("Errors and calls refused by billing")} icon={<AlertTriangle size={18} />} />
        <StatCard label={t("Average latency")} value={detail?.averageLatencyMs != null ? t("{ms} ms", { ms: formatNumber(detail.averageLatencyMs, t.locale) }) : "–"} icon={<Timer size={18} />} />
      </div>

      <Card className="mt-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>{t("Calls per day")}</CardTitle>
            <p className="type-body-small text-on-surface-variant">{t("Hong Kong time")}</p>
          </div>
          <nav aria-label={t("Range")} className="flex gap-1">
            {RANGES.map((range) => (
              <ButtonLink key={range} href={clientHref(client, range)} variant={range === days ? "tonal" : "text"} aria-current={range === days ? "true" : undefined}>
                {t("{range} days", { range })}
              </ButtonLink>
            ))}
          </nav>
        </div>
        {detail ? <DailyBarChart data={detail.daily} label={t("Calls per day")} /> : <p className="type-body-medium text-on-surface-variant">{t("Usage is unavailable right now.")}</p>}
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>{t("By tool")}</CardTitle>
          <p className="mb-4 type-body-small text-on-surface-variant">{t("Last {days} days", { days })}</p>
          {breakdown ? (
            <HorizontalBars rows={breakdown.byTool.map((row) => ({ label: row.tool, value: row.calls }))} empty={t("No tool calls in this range.")} />
          ) : (
            <p className="type-body-medium text-on-surface-variant">{t("The breakdown is unavailable right now.")}</p>
          )}
        </Card>
        <Card>
          <CardTitle>{t("By provider")}</CardTitle>
          <p className="mb-4 type-body-small text-on-surface-variant">{t("Last {days} days", { days })}</p>
          {breakdown ? (
            <HorizontalBars rows={breakdown.byProvider.map((row) => ({ label: row.title, detail: row.service, value: row.calls }))} empty={t("No tool calls in this range.")} />
          ) : (
            <p className="type-body-medium text-on-surface-variant">{t("The breakdown is unavailable right now.")}</p>
          )}
        </Card>
      </div>
    </>
  );
}
