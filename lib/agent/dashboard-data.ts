import "server-only";
import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, oauthGrants, telegramLinks, whatsappLinks } from "@/db/schema";
import { serviceById } from "@/generated/registry";
import type { DashboardData, KeySummary } from "@/lib/agent/dashboard-tools";
import { checkKeyUsable } from "@/lib/api-keys";
import type { AppUser } from "@/lib/auth";
import { billingConfig } from "@/lib/billing/config";
import { activePlans, getEntitlements, subscriptionConfigured } from "@/lib/billing/subscription";
import { callsPerDay } from "@/lib/usage";

async function listKeys(userId: string): Promise<KeySummary[]> {
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    prefix: `${row.prefix}…`,
    status: checkKeyUsable(row) ?? "active",
    services: row.scopes.length ? row.scopes.map((id) => serviceById.get(id)?.title ?? id).join(", ") : "All services",
    calls: row.callCount,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  }));
}

async function planUsage(user: AppUser) {
  if (!subscriptionConfigured) return "Billing is not configured.";
  const entitlements = await getEntitlements(user);
  const usage = entitlements.usage.find((item) => item.key === billingConfig.usageItem);
  return {
    plan: activePlans(entitlements)[0]?.planName ?? "No plan",
    used: usage?.used ?? 0,
    limit: usage?.limit ?? null,
    resetsAt: usage?.resetsAt ?? null,
  };
}

const total = (rows: { value: number }[]) => rows.reduce((sum, row) => sum + row.value, 0);

/** Each figure is fetched on its own, so one that fails comes back as "unavailable" instead of failing the summary. */
async function accountSummary(user: AppUser) {
  const settle = async <T>(promise: Promise<T>) => promise.catch((error) => (console.error("[agent] account summary", error), "unavailable" as const));
  const [daily, plan, keys, apps, telegram, whatsapp] = await Promise.all([
    settle(callsPerDay(user, 30)),
    settle(planUsage(user)),
    settle(db.select({ value: count() }).from(apiKeys).where(and(eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt)))),
    settle(
      db
        .select({ value: count() })
        .from(oauthGrants)
        .where(and(eq(oauthGrants.userId, user.id), isNull(oauthGrants.revokedAt), gt(oauthGrants.expiresAt, new Date()))),
    ),
    settle(db.select({ value: count() }).from(telegramLinks).where(eq(telegramLinks.userId, user.id))),
    settle(db.select({ value: count() }).from(whatsappLinks).where(eq(whatsappLinks.userId, user.id))),
  ]);
  const first = (rows: typeof keys) => (rows === "unavailable" ? rows : (rows[0]?.value ?? 0));
  return {
    callsToday: daily === "unavailable" ? daily : (daily.at(-1)?.value ?? 0),
    callsLast30Days: daily === "unavailable" ? daily : total(daily),
    plan,
    activeApiKeys: first(keys),
    connectedApps: first(apps),
    linkedTelegramAccounts: first(telegram),
    linkedWhatsAppNumbers: first(whatsapp),
    timeZone: "Asia/Hong_Kong",
  };
}

/** The dashboard tools' view of one user's account. */
export function dashboardData(user: AppUser): DashboardData {
  return { listKeys: () => listKeys(user.id), accountSummary: () => accountSummary(user) };
}
