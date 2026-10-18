import { ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/m3/button";
import { Card, CardTitle } from "@/components/m3/card";
import { Badge } from "@/components/m3/chip";
import { EmptyState } from "@/components/m3/page-header";
import { requirePageUser } from "@/lib/auth";
import { formatNumber, formatRelative } from "@/lib/format";
import { callsByClient } from "@/lib/usage";
import { CLIENT_KIND_LABELS, ClientIcon } from "./client-icon";
import { clientHref, daysSchema, firstParam, RANGES } from "./params";

export const metadata = { title: "Usage by client" };

export default async function UsageClientsPage({ searchParams }: PageProps<"/usage/clients">) {
  const user = await requirePageUser();
  const days = daysSchema.parse(firstParam((await searchParams).days));
  const clients = await callsByClient(user, days).catch((error) => (console.error("[usage] clients", error), null));
  const max = Math.max(1, ...(clients ?? []).map((client) => client.calls));

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <div>
          <CardTitle>By client</CardTitle>
          <p className="type-body-small text-on-surface-variant">API keys, connected apps and the agent in each channel, last {days} days</p>
        </div>
        <nav aria-label="Range" className="flex gap-1">
          {RANGES.map((range) => (
            <ButtonLink key={range} href={`/usage/clients?days=${range}`} variant={range === days ? "tonal" : "text"} aria-current={range === days ? "true" : undefined}>
              {range} days
            </ButtonLink>
          ))}
        </nav>
      </div>
      {!clients ? (
        <p className="p-4 type-body-medium text-on-surface-variant">Usage by client is unavailable right now.</p>
      ) : clients.length === 0 ? (
        <div className="p-4">
          <EmptyState icon={<Users size={32} />} title="No calls in this range">
            Calls from your API keys, connected apps, Telegram and WhatsApp will appear here.
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
                    <span className="truncate type-body-large">{client.label}</span>
                    <Badge>{CLIENT_KIND_LABELS[client.kind]}</Badge>
                  </span>
                  <span className="h-1.5 rounded-r-[4px] bg-primary" style={{ width: `${Math.max(1, (client.calls / max) * 100)}%` }} aria-hidden />
                  <span className="type-body-small text-on-surface-variant">
                    {client.lastCallAt ? `Last call ${formatRelative(client.lastCallAt)}` : "No calls"}
                    {client.errors ? ` · ${formatNumber(client.errors)} failed or denied` : ""}
                  </span>
                </span>
                <span className="type-title-medium tabular-nums">{formatNumber(client.calls)}</span>
                <ChevronRight size={18} className="text-on-surface-variant" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
