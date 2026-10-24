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
      chatAllowance: { used: number; limit: number | null; remaining: number | null; resetsAt: string | null } | null;
      premiumAllowance: { used: number; limit: number | null; remaining: number | null; resetsAt: string | null } | null;
      allowance: { used: number; limit: number | null; remaining: number | null; resetsAt: string | null } | null;
    };

/** Always derive the identity from the session, and keep this personal data out of public catalogue HTML. */
export async function currentChatAllowance(): Promise<ChatAllowance> {
  const user = await getCurrentUser();
  if (!user) return { kind: "guest", quota: await currentFreeChatQuota() };
  const base = { kind: "member" as const, metering: billingConfig.enabled, allowance: null, chatAllowance: null, premiumAllowance: null };
  if (!subscriptionConfigured) return { ...base, billing: "unconfigured" };
  try {
    const entitlements = await getEntitlements(user);
    const usage = entitlements.usage.find((item) => item.key === billingConfig.usageItem);
    const chat = entitlements.usage.find((item) => item.key === billingConfig.chatUsageItem);
    const premium = entitlements.usage.find((item) => item.key === billingConfig.premiumUsageItem);
    return {
      ...base,
      billing: "ready",
      chatAllowance: chat ? { used: chat.used, limit: chat.limit, remaining: chat.limit === null ? null : (chat.remaining ?? Math.max(0, chat.limit - chat.used)), resetsAt: chat.resetsAt } : null,
      premiumAllowance: premium ? { used: premium.used, limit: premium.limit, remaining: premium.limit === null ? null : (premium.remaining ?? Math.max(0, premium.limit - premium.used)), resetsAt: premium.resetsAt } : null,
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
