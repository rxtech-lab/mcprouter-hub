import { Activity, ArrowRight, Blocks, CalendarRange, Gauge, KeyRound, Lightbulb, MessageSquareText } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { DailyBarChart } from "@/components/charts";
import { ButtonLink } from "@/components/m3/button";
import { Card, CardTitle, StatCard } from "@/components/m3/card";
import { LinearProgress } from "@/components/m3/progress";
import { requirePageUser, type AppUser } from "@/lib/auth";
import { billingConfig } from "@/lib/billing/config";
import { activePlans, getEntitlements, subscriptionConfigured } from "@/lib/billing/subscription";
import manifest from "@/generated/manifest.json";
import { formatDateTime, formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { INTRO_CARDS, introCardById, type IntroCard } from "@/lib/intro-cards";
import { unreadIntroCards } from "@/lib/intro";
import { callsPerDay } from "@/lib/usage";
import { IntroDialog } from "./intro-dialog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Overview") };
}

async function planUsage(user: AppUser) {
  if (!subscriptionConfigured) return null;
  try {
    const entitlements = await getEntitlements(user);
    return {
      usage: entitlements.usage.find((item) => item.key === billingConfig.usageItem) ?? null,
      plan: activePlans(entitlements)[0]?.planName ?? null,
    };
  } catch (error) {
    console.error("[dashboard] entitlements failed", error);
    return null;
  }
}

/**
 * The intro dialog's cards. `?intro=all` replays every card, `?intro=<card id>` opens one (the agent links to these);
 * otherwise it shows whatever the user hasn't read, which is nothing once they've been through it.
 */
async function introCards(userId: string, intro: string | undefined): Promise<IntroCard[]> {
  if (intro === "all") return INTRO_CARDS;
  const card = introCardById(intro);
  if (card) return [card];
  return unreadIntroCards(userId).catch((error) => (console.error("[dashboard] intro cards failed", error), []));
}

export default async function OverviewPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requirePageUser();
  const t = await getT();
  const { intro: rawIntro } = await searchParams;
  const intro = Array.isArray(rawIntro) ? rawIntro[0] : rawIntro;
  const [daily, [{ activeKeys }], plan, cards] = await Promise.all([
    callsPerDay(user, 30).catch((error) => (console.error("[dashboard] statistics failed", error), null)),
    db.select({ activeKeys: count() }).from(apiKeys).where(and(eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt))),
    planUsage(user),
    introCards(user.id, intro),
  ]);

  const today = daily?.at(-1)?.value ?? 0;
  const last30 = daily?.reduce((sum, row) => sum + row.value, 0) ?? 0;
  const toolCount = manifest.services.reduce((sum, service) => sum + service.tools.length, 0);

  return (
    <>
      <section className="mb-6 flex flex-col gap-6 rounded-xl bg-primary-container p-6 text-on-primary-container md:flex-row md:items-end md:justify-between md:p-8">
        <div>
          <h1 className="type-headline-large md:type-display-small">{t("Hello, {name}", { name: user.name.split(" ")[0] })}</h1>
          <p className="mt-2 max-w-xl type-body-large opacity-90">
            {today > 0
              ? t.plural("{n} tool call so far today.", "{n} tool calls so far today.", today, { n: formatNumber(today, t.locale) })
              : t("No tool calls yet today.")}{" "}
            {t("{services} services and {tools} tools are ready.", { services: manifest.services.length, tools: toolCount })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/keys" icon={<KeyRound size={18} />}>{t("API keys")}</ButtonLink>
          <ButtonLink href="/chat" variant="elevated" icon={<MessageSquareText size={18} />}>{t("Ask the agent")}</ButtonLink>
          <ButtonLink href="/dashboard?intro=all" variant="text" icon={<Lightbulb size={18} />} scroll={false} className="text-on-primary-container">
            {t("Tour and what's new")}
          </ButtonLink>
        </div>
      </section>
      {/* Remounted per `?intro`, so asking for the tour again opens it even after it was closed. */}
      <IntroDialog key={intro ?? "unread"} cards={cards} replay={intro === "all"} />
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("Calls today")} value={formatNumber(today, t.locale)} icon={<Activity size={18} />} />
        <StatCard label={t("Calls, last 30 days")} value={formatNumber(last30, t.locale)} icon={<CalendarRange size={18} />} />
        <StatCard label={t("Active API keys")} value={formatNumber(activeKeys, t.locale)} icon={<KeyRound size={18} />} />
        <PlanCard plan={plan} />
      </div>
      <Card className="mt-4 rounded-lg p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <CardTitle>{t("Calls per day")}</CardTitle>
            <p className="type-body-small text-on-surface-variant">{t("Last 30 days, Hong Kong time")}</p>
          </div>
          <ButtonLink href="/usage" variant="text">
            {t("Usage")} <ArrowRight size={16} />
          </ButtonLink>
        </div>
        {daily ? <DailyBarChart data={daily} label={t("Calls per day")} /> : <p className="type-body-medium text-on-surface-variant">{t("Usage is unavailable right now.")}</p>}
      </Card>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Shortcut href="/services" icon={<Blocks size={22} />} title={t("Browse services")} body={t("Every tool, its inputs and the datasets behind it.")} />
        <Shortcut href="/usage" icon={<Activity size={22} />} title={t("Usage and credits")} body={t("Calls per day and your credit history.")} />
        <Shortcut href="/billing" icon={<Gauge size={22} />} title={t("Plan and billing")} body={t("Check your allowance or change your plan.")} />
      </div>
    </>
  );
}

function Shortcut({ href, icon, title, body }: { href: string; icon: ReactNode; title: string; body: string }) {
  return (
    <Link href={href} className="state-layer group flex items-start gap-4 rounded-lg bg-surface-container-low p-5 text-on-surface">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="type-title-medium">{title}</span>
        <span className="type-body-medium text-on-surface-variant">{body}</span>
      </span>
      <ArrowRight size={18} className="mt-1 text-on-surface-variant transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

async function PlanCard({ plan }: { plan: Awaited<ReturnType<typeof planUsage>> }) {
  const t = await getT();
  const usage = plan?.usage;
  return (
    <Card variant="filled" className="flex flex-col gap-2">
      <span className="flex items-center justify-between gap-2 type-label-large text-on-surface-variant">
        {plan?.plan ?? t("Plan usage")}
        <span className="flex size-9 items-center justify-center rounded-full bg-surface-container-lowest text-primary">
          <Gauge size={18} />
        </span>
      </span>
      {usage ? (
        <>
          <span className="type-headline-medium tabular-nums">
            {formatNumber(usage.used, t.locale)}
            <span className="type-title-medium text-on-surface-variant"> / {usage.limit === null ? "∞" : formatNumber(usage.limit, t.locale)}</span>
          </span>
          {usage.limit ? <LinearProgress value={usage.used / usage.limit} label={t("Plan usage")} /> : null}
          <span className="type-body-small text-on-surface-variant">{usage.resetsAt ? t("Resets {date}", { date: formatDateTime(usage.resetsAt, t.locale) }) : t("Calls included in your plan")}</span>
        </>
      ) : (
        <span className="type-body-medium text-on-surface-variant">{subscriptionConfigured ? t("No metered plan yet.") : t("Billing is not configured.")}</span>
      )}
    </Card>
  );
}
