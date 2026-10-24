import "server-only";

export const billingConfig = {
  enabled: process.env.BILLING_ENABLED === "true",
  /** rx-subscription usage item charged once per MCP tool call. */
  usageItem: "mcp_calls",
  /** Separate allowance for paid news tools, including tools invoked during chat. */
  premiumUsageItem: "premium_mcp",
  /** One metered event per signed-in user message. */
  chatUsageItem: "chat",
} as const;

export function mcpUsageItem(service: string) {
  return service === "unified-news" ? billingConfig.premiumUsageItem : billingConfig.usageItem;
}
