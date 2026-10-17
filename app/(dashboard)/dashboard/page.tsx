import { Activity, ArrowRight, Blocks, CalendarRange, Gauge, KeyRound, MessageSquareText } from "lucide-react";
import Link from "next/link";
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
import { callsPerDay } from "@/lib/usage";

export const metadata = { title: "Overview" };

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

export default async function OverviewPage() {
  const user = await requirePageUser();
  const [daily, [{ activeKeys }], plan] = await Promise.all([
    callsPerDay(user, 30).catch((error) => (console.error("[dashboard] statistics failed", error), null)),
    db.select({ activeKeys: count() }).from(apiKeys).where(and(eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt))),
    planUsage(user),
  ]);

  const today = daily?.at(-1)?.value ?? 0;
  const last30 = daily?.reduce((sum, row) => sum + row.value, 0) ?? 0;
  const toolCount = manifest.services.reduce((sum, service) => sum + service.tools.length, 0);

  return (
    <>
      <section className="mb-6 flex flex-col gap-6 rounded-xl bg-primary-container p-6 text-on-primary-container md:flex-row md:items-end md:justify-between md:p-8">
        <div>
          <h1 className="type-headline-large md:type-display-small">Hello, {user.name.split(" ")[0]}</h1>
          <p className="mt-2 max-w-xl type-body-large opacity-90">
            {today > 0 ? `${formatNumber(today)} tool ${today === 1 ? "call" : "calls"} so far today.` : "No tool calls yet today."} {manifest.services.length} services and {toolCount} tools are ready.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/keys" icon={<KeyRound size={18} />}>API keys</ButtonLink>
          <ButtonLink href="/chat" variant="elevated" icon={<MessageSquareText size={18} />}>Ask the agent</ButtonLink>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Calls today" value={formatNumber(today)} icon={<Activity size={18} />} />
        <StatCard label="Calls, last 30 days" value={formatNumber(last30)} icon={<CalendarRange size={18} />} />
        <StatCard label="Active API keys" value={formatNumber(activeKeys)} icon={<KeyRound size={18} />} />
        <PlanCard plan={plan} />
      </div>
      <Card className="mt-4 rounded-lg p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <CardTitle>Calls per day</CardTitle>
            <p className="type-body-small text-on-surface-variant">Last 30 days, Hong Kong time</p>
          </div>
          <ButtonLink href="/usage" variant="text">
            Usage <ArrowRight size={16} />
          </ButtonLink>
        </div>
        {daily ? <DailyBarChart data={daily} label="Calls per day" /> : <p className="type-body-medium text-on-surface-variant">Usage is unavailable right now.</p>}
      </Card>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Shortcut href="/services" icon={<Blocks size={22} />} title="Browse services" body="Every tool, its inputs and the datasets behind it." />
        <Shortcut href="/usage" icon={<Activity size={22} />} title="Usage and credits" body="Calls per day and your credit history." />
        <Shortcut href="/billing" icon={<Gauge size={22} />} title="Plan and billing" body="Check your allowance or change your plan." />
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

function PlanCard({ plan }: { plan: Awaited<ReturnType<typeof planUsage>> }) {
  const usage = plan?.usage;
  return (
    <Card variant="filled" className="flex flex-col gap-2">
      <span className="flex items-center justify-between gap-2 type-label-large text-on-surface-variant">
        {plan?.plan ?? "Plan usage"}
        <span className="flex size-9 items-center justify-center rounded-full bg-surface-container-lowest text-primary">
          <Gauge size={18} />
        </span>
      </span>
      {usage ? (
        <>
          <span className="type-headline-medium tabular-nums">
            {formatNumber(usage.used)}
            <span className="type-title-medium text-on-surface-variant"> / {usage.limit === null ? "∞" : formatNumber(usage.limit)}</span>
          </span>
          {usage.limit ? <LinearProgress value={usage.used / usage.limit} label="Plan usage" /> : null}
          <span className="type-body-small text-on-surface-variant">{usage.resetsAt ? `Resets ${formatDateTime(usage.resetsAt)}` : "Calls included in your plan"}</span>
        </>
      ) : (
        <span className="type-body-medium text-on-surface-variant">{subscriptionConfigured ? "No metered plan yet." : "Billing is not configured."}</span>
      )}
    </Card>
  );
}
