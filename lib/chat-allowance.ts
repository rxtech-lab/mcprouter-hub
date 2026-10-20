import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { billingConfig } from "@/lib/billing/config";
import { getEntitlements, subscriptionConfigured } from "@/lib/billing/subscription";
import { currentFreeChatQuota, type FreeChatQuota } from "@/lib/free-chat";

export type ChatAllowance =
  | { kind: "guest"; quota: FreeChatQuota }
  | {
      kind: "member";
      billing: "ready" | "unavailable" | "unconfigured";
      metering: boolean;
      credits: { unit: string; name: string; available: number }[];
      allowance: { used: number; limit: number | null; remaining: number | null; resetsAt: string | null } | null;
    };

/** Always derive the identity from the session, and keep this personal data out of public catalogue HTML. */
export async function currentChatAllowance(): Promise<ChatAllowance> {
  const user = await getCurrentUser();
  if (!user) return { kind: "guest", quota: await currentFreeChatQuota() };
  const base = { kind: "member" as const, metering: billingConfig.enabled, credits: [], allowance: null };
  if (!subscriptionConfigured) return { ...base, billing: "unconfigured" };
  try {
    const entitlements = await getEntitlements(user);
    const usage = entitlements.usage.find((item) => item.key === billingConfig.usageItem);
    return {
      ...base,
      billing: "ready",
      credits: entitlements.balances.filter((balance) => !billingConfig.creditUnit || balance.unit === billingConfig.creditUnit)
        .map(({ unit, name, available }) => ({ unit, name, available })),
      allowance: usage ? {
        used: usage.used, limit: usage.limit,
        remaining: usage.limit === null ? null : (usage.remaining ?? Math.max(0, usage.limit - usage.used)),
        resetsAt: usage.resetsAt,
      } : null,
    };
  } catch {
    return { ...base, billing: "unavailable" };
  }
}
