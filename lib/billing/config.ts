import "server-only";

export const billingConfig = {
  enabled: process.env.BILLING_ENABLED === "true",
  /** rx-subscription usage item charged once per MCP tool call. */
  usageItem: "mcp_calls",
  /** Usage item shown for reference; it does not override the chat balance gate. */
  chatUsageItem: "chat",
  /** One unit debited before each user message, regardless of the plan's usage limit. */
  chatCreditUnit: "chat",
  /** Balance unit debited once per direct MCP call. Set undefined to use the MCP plan allowance. */
  creditUnit: "mcp-calls" as string | undefined,
} as const;
