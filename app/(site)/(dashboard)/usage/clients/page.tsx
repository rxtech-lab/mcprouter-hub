import { ChevronRight, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/m3/button";
import { Card, CardTitle } from "@/components/m3/card";
import { Badge } from "@/components/m3/chip";
import { EmptyState } from "@/components/m3/page-header";
import { requirePageUser } from "@/lib/auth";
import { formatNumber, formatRelative } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { callsByClient } from "@/lib/usage";
import { CLIENT_KIND_LABELS, ClientIcon } from "./client-icon";
import { clientHref, daysSchema, firstParam, RANGES } from "./params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Usage by client") };
}

export default async function UsageClientsPage({ searchParams }: PageProps<"/usage/clients">) {
  const user = await requirePageUser();
  const t = await getT();
  const days = daysSchema.parse(firstParam((await searchParams).days));
  const clients = await callsByClient(user, days).catch((error) => (console.error("[usage] clients", error), null));
  const max = Math.max(1, ...(clients ?? []).map((client) => client.calls));

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <div>
          <CardTitle>{t("By client")}</CardTitle>
          <p className="type-body-small text-on-surface-variant">{t("API keys, connected apps and the agent in each channel, last {days} days", { days })}</p>
        </div>
        <nav aria-label={t("Range")} className="flex gap-1">
          {RANGES.map((range) => (
            <ButtonLink key={range} href={`/usage/clients?days=${range}`} variant={range === days ? "tonal" : "text"} aria-current={range === days ? "true" : undefined}>
              {t("{range} days", { range })}
            </ButtonLink>
          ))}
        </nav>
      </div>
      {!clients ? (
        <p className="p-4 type-body-medium text-on-surface-variant">{t("Usage by client is unavailable right now.")}</p>
      ) : clients.length === 0 ? (
        <div className="p-4">
          <EmptyState icon={<Users size={32} />} title={t("No calls in this range")}>
            {t("Calls from your API keys, connected apps, Telegram and WhatsApp will appear here.")}
          </EmptyState>
        </div>
      ) : (
        <ul className="stagger mt-2">
          {clients.map((client) => (
            <li key={client.id} className="border-b border-outline-variant last:border-0">
              <Link href={clientHref(client.id, days)} className="state-layer flex items-center gap-4 px-4 py-3 text-on-surface">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                  <ClientIcon kind={client.kind} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate type-body-large">{t(client.label)}</span>
                    <Badge>{t(CLIENT_KIND_LABELS[client.kind])}</Badge>
                  </span>
                  <span className="h-1.5 rounded-r-[4px] bg-primary" style={{ width: `${Math.max(1, (client.calls / max) * 100)}%` }} aria-hidden />
                  <span className="type-body-small text-on-surface-variant">
                    {client.lastCallAt ? t("Last call {time}", { time: formatRelative(client.lastCallAt, undefined, t.locale) }) : t("No calls")}
                    {client.errors ? ` · ${t("{n} failed or denied", { n: formatNumber(client.errors, t.locale) })}` : ""}
                  </span>
                </span>
                <span className="type-title-medium tabular-nums">{formatNumber(client.calls, t.locale)}</span>
                <ChevronRight size={18} className="text-on-surface-variant" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
