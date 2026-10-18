import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { z } from "zod";
import { ButtonLink } from "@/components/m3/button";
import { Card, CardTitle } from "@/components/m3/card";
import { Badge } from "@/components/m3/chip";
import { EmptyState } from "@/components/m3/page-header";
import { Pagination } from "@/components/m3/pagination";
import { requirePageUser } from "@/lib/auth";
import { billingConfig } from "@/lib/billing/config";
import { getBalanceLedger, getEntitlements, subscriptionConfigured } from "@/lib/billing/subscription";
import { formatDateTime, formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Credits") };
}

const paramsSchema = z.object({ page: z.coerce.number().int().min(1).catch(1) });

export default async function UsageCreditsPage({ searchParams }: PageProps<"/usage/credits">) {
  const user = await requirePageUser();
  const t = await getT();
  if (!subscriptionConfigured) {
    return <EmptyState title={t("Billing is not configured")}>{t("Set RX_SUBSCRIPTION_URL and RX_SUBSCRIPTION_API_KEY to show credits.")}</EmptyState>;
  }

  const raw = await searchParams;
  const { page } = paramsSchema.parse({ page: Array.isArray(raw.page) ? raw.page[0] : raw.page });
  const [entitlements, ledger] = await Promise.all([
    getEntitlements(user).catch((error) => (console.error("[credits] entitlements", error), null)),
    getBalanceLedger({ user, unit: billingConfig.creditUnit, page }).catch((error) => (console.error("[credits] ledger", error), null)),
  ]);
  const balances = (entitlements?.balances ?? []).filter((balance) => !billingConfig.creditUnit || balance.unit === billingConfig.creditUnit);

  return (
    <>
      <Card variant="filled" className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <CardTitle>{t("Credit balance")}</CardTitle>
          {balances.length ? (
            balances.map((balance) => (
              <p key={balance.unit} className="mt-2 type-headline-medium tabular-nums">
                {formatNumber(balance.available, t.locale)} <span className="type-title-medium text-on-surface-variant">{balance.name}</span>
              </p>
            ))
          ) : (
            <p className="mt-2 type-body-medium text-on-surface-variant">{entitlements ? t("No credits yet. Pay as you go calls are paid from credits.") : t("The balance is unavailable right now.")}</p>
          )}
        </div>
        <ButtonLink href="/billing" variant="tonal">{t("Top up")}</ButtonLink>
      </Card>

      <Card className="mt-4 overflow-hidden p-0">
        <CardTitle className="px-4 pt-4">{t("History")}</CardTitle>
        {!ledger ? (
          <p className="p-4 type-body-medium text-on-surface-variant">{t("The credit history couldn't be loaded.")}</p>
        ) : ledger.entries.length === 0 ? (
          <div className="p-4"><EmptyState title={t("No credit activity")}>{t("Top-ups and calls paid from credits will appear here.")}</EmptyState></div>
        ) : (
          <ul className="mt-2">
            {ledger.entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-4 border-b border-outline-variant px-4 py-3 last:border-0">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
                  {entry.delta >= 0 ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate type-body-large">{entry.description ?? entry.kind}</span>
                  <span className="type-body-small text-on-surface-variant">{formatDateTime(entry.createdAt, t.locale)}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <Badge tone={entry.delta >= 0 ? "success" : "neutral"}>{`${entry.delta >= 0 ? "+" : ""}${formatNumber(entry.delta, t.locale)}`}</Badge>
                  <span className="type-body-small text-on-surface-variant tabular-nums">{t("Balance {amount}", { amount: formatNumber(entry.balanceAfter, t.locale) })}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {ledger && ledger.pageCount > 1 ? (
        <Pagination page={ledger.page} pageCount={ledger.pageCount} total={ledger.total} noun={t.plural("entry", "entries", ledger.total)} href={(next) => `/usage/credits?page=${next}`} />
      ) : null}
    </>
  );
}
