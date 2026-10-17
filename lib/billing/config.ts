import "server-only";

export const billingConfig = {
  enabled: process.env.BILLING_ENABLED === "true",
  /** rx-subscription usage item charged once per MCP tool call. */
  usageItem: process.env.RX_SUBSCRIPTION_USAGE_ITEM?.trim() || "mcp_calls",
  /** Balance unit that pays for calls past the plan allowance. Unset shows every balance. */
  creditUnit: process.env.RX_SUBSCRIPTION_CREDIT_UNIT?.trim() || undefined,
} as const;
