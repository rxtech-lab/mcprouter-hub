import "server-only";
import { billingConfig } from "@/lib/billing/config";
import { getEntitlements, subscriptionConfigured } from "@/lib/billing/subscription";

/**
 * Whether the account can't pay for another tool call, using the same rules as the MCP meter:
 * with a credit unit, calls are paid from that balance; otherwise from the plan allowance,
 * then any balance. When billing is off or rx-subscription can't be reached, the meter decides.
 * The chat bots check this before answering, so they can send a billing link instead.
 */
export async function isOverLimit(user: { id: string; email: string }) {
  if (!billingConfig.enabled || !subscriptionConfigured) return false;
  try {
    const entitlements = await getEntitlements({ id: user.id, email: user.email, name: "", roles: [] });
    if (billingConfig.creditUnit) {
      return (entitlements.balances.find((balance) => balance.unit === billingConfig.creditUnit)?.available ?? 0) < 1;
    }
    const usage = entitlements.usage.find((item) => item.key === billingConfig.usageItem);
    const allowanceLeft = usage?.remaining === null || usage?.remaining === undefined || usage.remaining > 0;
    return !allowanceLeft && !entitlements.balances.some((balance) => balance.available > 0);
  } catch (error) {
    console.warn("[billing] could not check the allowance", error);
    return false;
  }
}
