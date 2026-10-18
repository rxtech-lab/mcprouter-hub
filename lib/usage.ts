import "server-only";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { toolCalls } from "@/db/schema";
import manifest from "@/generated/manifest.json";
import type { AppUser } from "@/lib/auth";
import { billingConfig } from "@/lib/billing/config";
import { getUsageStatistics, subscriptionConfigured } from "@/lib/billing/subscription";

/** Day buckets are Hong Kong days (UTC+8, no DST). */
const HK_OFFSET_MS = 8 * 3600 * 1000;

export function startOfHkDay(now = new Date()) {
  const shifted = new Date(now.getTime() + HK_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - HK_OFFSET_MS);
}

/** Start of the Hong Kong day `days - 1` days ago, i.e. the window `callsPerDay(…, days)` covers. */
export function windowStart(days: number, now = new Date()) {
  return new Date(startOfHkDay(now).getTime() - (days - 1) * 86_400_000);
}

/** rx-subscription allows 1,000 buckets per query, so hourly series stop at 41 days. */
export const MAX_WINDOW_DAYS = 41;

export type DailyUsage = { day: string; value: number; credits: number };

/**
 * MCP calls per Hong Kong day for the last `days` days, oldest first, read
 * from rx-subscription's usage log. Buckets are fetched hourly (UTC) and folded
 * into Hong Kong days, since rx-subscription's own day buckets are UTC.
 */
export async function callsPerDay(user: AppUser, days: number): Promise<DailyUsage[]> {
  const since = windowStart(Math.min(days, MAX_WINDOW_DAYS));
  const empty = Array.from({ length: days }, (_, index) => ({
    day: new Date(since.getTime() + index * 86_400_000 + HK_OFFSET_MS).toISOString().slice(0, 10),
    value: 0,
    credits: 0,
  }));
  if (!subscriptionConfigured) return empty;

  const buckets = await getUsageStatistics({ user, item: billingConfig.usageItem, from: since, to: new Date(), granularity: "hour" });
  const byDay = new Map(empty.map((row) => [row.day, row]));
  for (const bucket of buckets) {
    const day = new Date(new Date(bucket.start).getTime() + HK_OFFSET_MS).toISOString().slice(0, 10);
    const row = byDay.get(day);
    if (!row) continue;
    row.value += bucket.amount;
    row.credits += bucket.chargedUnits;
  }
  return empty;
}

export type ToolCallLog = Omit<typeof toolCalls.$inferInsert, "id" | "createdAt">;

export async function logToolCall(entry: ToolCallLog) {
  await db.insert(toolCalls).values(entry);
}

export type CallBreakdown = {
  byTool: Array<{ tool: string; service: string; calls: number }>;
  byProvider: Array<{ service: string; title: string; calls: number }>;
};

const serviceTitles = new Map(manifest.services.map((service) => [service.id, service.title]));
/** Calls logged under a service that was later merged into another count towards the merged one. */
const canonicalServiceIds = new Map(manifest.services.flatMap((service) => service.aliases.map((alias) => [alias, service.id] as const)));

/** Calls since the start of the `days` window, grouped by tool and by the service (provider) behind it, busiest first. */
export async function callsByTool(user: AppUser, days: number): Promise<CallBreakdown> {
  const calls = count().as("calls");
  const rows = await db
    .select({ service: toolCalls.service, tool: toolCalls.tool, calls })
    .from(toolCalls)
    .where(and(eq(toolCalls.userId, user.id), gte(toolCalls.createdAt, windowStart(days))))
    .groupBy(toolCalls.service, toolCalls.tool)
    .orderBy(desc(calls));

  const providers = new Map<string, number>();
  const tools = new Map<string, { tool: string; service: string; calls: number }>();
  for (const row of rows) {
    const service = canonicalServiceIds.get(row.service) ?? row.service;
    const key = `${service}\n${row.tool}`;
    const entry = tools.get(key) ?? { tool: row.tool, service, calls: 0 };
    entry.calls += row.calls;
    tools.set(key, entry);
    providers.set(service, (providers.get(service) ?? 0) + row.calls);
  }
  return {
    byTool: [...tools.values()].sort((a, b) => b.calls - a.calls),
    byProvider: [...providers]
      .map(([service, total]) => ({ service, title: serviceTitles.get(service) ?? service, calls: total }))
      .sort((a, b) => b.calls - a.calls),
  };
}
