import "server-only";
import { and, avg, count, desc, eq, gte, inArray, isNull, max, sql, sum, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, oauthClients, toolCalls } from "@/db/schema";
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

/**
 * Calls since the start of the `days` window, grouped by tool and by the service (provider) behind it, busiest first.
 * `client` narrows it to one client from `callsByClient`.
 */
export async function callsByTool(user: AppUser, days: number, client?: ClientId): Promise<CallBreakdown> {
  const calls = count().as("calls");
  const rows = await db
    .select({ service: toolCalls.service, tool: toolCalls.tool, calls })
    .from(toolCalls)
    .where(and(eq(toolCalls.userId, user.id), gte(toolCalls.createdAt, windowStart(days)), client ? clientFilter(client) : undefined))
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

// ------------------------------------------------------------------ by client

/**
 * One place calls come from, as it appears in the URL: `key:<api key id>`,
 * `oauth:<client id>`, `web`, `telegram`, `whatsapp`, or `agent` for agent
 * calls logged before the channel was recorded.
 */
export type ClientId = `key:${string}` | `oauth:${string}` | "web" | "telegram" | "whatsapp" | "agent";
export type ClientKind = "key" | "oauth" | "web" | "telegram" | "whatsapp" | "agent";

export type ClientUsage = {
  id: ClientId;
  kind: ClientKind;
  label: string;
  calls: number;
  errors: number;
  lastCallAt: Date | null;
};

const AGENT_LABELS = {
  web: "Web chat",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  agent: "Agent (before channels were tracked)",
} as const;

export function parseClientId(value: string | undefined): ClientId | null {
  if (!value) return null;
  if (Object.hasOwn(AGENT_LABELS, value)) return value as ClientId;
  const match = /^(key|oauth):(.+)$/.exec(value);
  return match ? (value as ClientId) : null;
}

function clientKind(client: ClientId): ClientKind {
  return client.startsWith("key:") ? "key" : client.startsWith("oauth:") ? "oauth" : (client as ClientKind);
}

/** The rows that belong to one client. Old rows have no channel: those with a key are the key's, the rest are `agent`. */
function clientFilter(client: ClientId): SQL | undefined {
  if (client.startsWith("key:")) return eq(toolCalls.apiKeyId, client.slice(4));
  if (client.startsWith("oauth:")) return and(eq(toolCalls.channel, "oauth"), eq(toolCalls.oauthClientId, client.slice(6)));
  if (client === "agent") return and(isNull(toolCalls.channel), isNull(toolCalls.apiKeyId));
  return eq(toolCalls.channel, client as "web" | "telegram" | "whatsapp");
}

function clientIdOf(row: { channel: string | null; apiKeyId: string | null; oauthClientId: string | null }): ClientId | null {
  if (row.apiKeyId) return `key:${row.apiKeyId}`;
  if (row.channel === "oauth") return row.oauthClientId ? `oauth:${row.oauthClientId}` : null;
  if (row.channel === "web" || row.channel === "telegram" || row.channel === "whatsapp") return row.channel;
  // The free agent's calls belong to guests, never to a member.
  if (row.channel === "free") return null;
  return "agent";
}

/** Names for the API keys and OAuth apps behind `clients`, including revoked keys so their history stays readable. */
async function clientLabels(user: AppUser, clients: ClientId[]) {
  const keyIds = clients.filter((id) => id.startsWith("key:")).map((id) => id.slice(4));
  const appIds = clients.filter((id) => id.startsWith("oauth:")).map((id) => id.slice(6));
  const [keys, apps] = await Promise.all([
    keyIds.length
      ? db.select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix }).from(apiKeys).where(and(eq(apiKeys.userId, user.id), inArray(apiKeys.id, keyIds)))
      : [],
    appIds.length ? db.select({ id: oauthClients.id, name: oauthClients.name }).from(oauthClients).where(inArray(oauthClients.id, appIds)) : [],
  ]);
  const labels = new Map<ClientId, string>();
  for (const key of keys) labels.set(`key:${key.id}`, `${key.name} (${key.prefix}…)`);
  for (const app of apps) labels.set(`oauth:${app.id}`, app.name);
  return (client: ClientId) => labels.get(client) ?? (Object.hasOwn(AGENT_LABELS, client) ? AGENT_LABELS[client as keyof typeof AGENT_LABELS] : client.startsWith("key:") ? "Deleted API key" : "Removed app");
}

/** Calls since the start of the `days` window by the API key, OAuth app or agent channel that made them, busiest first. */
export async function callsByClient(user: AppUser, days: number): Promise<ClientUsage[]> {
  const rows = await db
    .select({
      channel: toolCalls.channel,
      apiKeyId: toolCalls.apiKeyId,
      oauthClientId: toolCalls.oauthClientId,
      calls: count(),
      errors: sum(sql<number>`case when ${toolCalls.status} = 'ok' then 0 else 1 end`).mapWith(Number),
      lastCallAt: max(toolCalls.createdAt),
    })
    .from(toolCalls)
    .where(and(eq(toolCalls.userId, user.id), gte(toolCalls.createdAt, windowStart(days))))
    .groupBy(toolCalls.channel, toolCalls.apiKeyId, toolCalls.oauthClientId);

  const clients = new Map<ClientId, Omit<ClientUsage, "label">>();
  for (const row of rows) {
    const id = clientIdOf(row);
    if (!id) continue;
    const entry = clients.get(id) ?? { id, kind: clientKind(id), calls: 0, errors: 0, lastCallAt: null };
    entry.calls += row.calls;
    entry.errors += row.errors ?? 0;
    const last = row.lastCallAt === null ? null : new Date(row.lastCallAt);
    if (last && (!entry.lastCallAt || last > entry.lastCallAt)) entry.lastCallAt = last;
    clients.set(id, entry);
  }
  const label = await clientLabels(user, [...clients.keys()]);
  return [...clients.values()].map((entry) => ({ ...entry, label: label(entry.id) })).sort((a, b) => b.calls - a.calls);
}

export type ClientDetail = {
  id: ClientId;
  kind: ClientKind;
  label: string;
  daily: Array<{ day: string; value: number }>;
  calls: number;
  errors: number;
  averageLatencyMs: number | null;
  lastCallAt: Date | null;
};

/** One client's calls per Hong Kong day over the `days` window, oldest first, with totals. Read from the local call log. */
export async function clientUsage(user: AppUser, client: ClientId, days: number): Promise<ClientDetail> {
  const since = windowStart(days);
  const day = sql<string>`strftime('%Y-%m-%d', (${toolCalls.createdAt} + ${HK_OFFSET_MS}) / 1000, 'unixepoch')`;
  const where = and(eq(toolCalls.userId, user.id), gte(toolCalls.createdAt, since), clientFilter(client));
  const [perDay, [totals], label] = await Promise.all([
    db.select({ day, calls: count() }).from(toolCalls).where(where).groupBy(day),
    db
      .select({
        calls: count(),
        errors: sum(sql<number>`case when ${toolCalls.status} = 'ok' then 0 else 1 end`).mapWith(Number),
        averageLatencyMs: avg(toolCalls.latencyMs).mapWith(Number),
        lastCallAt: max(toolCalls.createdAt),
      })
      .from(toolCalls)
      .where(where),
    clientLabels(user, [client]),
  ]);
  const counts = new Map(perDay.map((row) => [row.day, row.calls]));
  const daily = Array.from({ length: days }, (_, index) => {
    const key = new Date(since.getTime() + index * 86_400_000 + HK_OFFSET_MS).toISOString().slice(0, 10);
    return { day: key, value: counts.get(key) ?? 0 };
  });
  return {
    id: client,
    kind: clientKind(client),
    label: label(client),
    daily,
    calls: totals?.calls ?? 0,
    errors: totals?.errors ?? 0,
    averageLatencyMs: totals?.calls ? Math.round(totals.averageLatencyMs ?? 0) : null,
    lastCallAt: totals?.lastCallAt ? new Date(totals.lastCallAt) : null,
  };
}
