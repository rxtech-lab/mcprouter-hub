import type { ModelMessage, SystemModelMessage, ToolSet } from "ai";

/**
 * Prompt caching for the agent. Every request is laid out so the provider can
 * reuse the previous prefix:
 *   tools (sorted, so the order is stable) → instructions [breakpoint] → messages … last [breakpoint]
 * Anthropic allows four breakpoints; this uses two. Other providers cache
 * through the gateway's `caching: "auto"`.
 */

const BREAKPOINT = { anthropic: { cacheControl: { type: "ephemeral" as const } } };

export const gatewayCaching = { gateway: { caching: "auto" as const } };

export function cachedInstructions(text: string): SystemModelMessage {
  return { role: "system", content: text, providerOptions: BREAKPOINT };
}

function withoutBreakpoint(message: ModelMessage): ModelMessage {
  const anthropic = message.providerOptions?.anthropic;
  if (!anthropic || !("cacheControl" in anthropic)) return message;
  const providerOptions = { ...message.providerOptions };
  const rest = Object.fromEntries(Object.entries(anthropic).filter(([key]) => key !== "cacheControl"));
  if (Object.keys(rest).length) providerOptions.anthropic = rest as typeof anthropic;
  else delete providerOptions.anthropic;
  return { ...message, providerOptions: Object.keys(providerOptions).length ? providerOptions : undefined } as ModelMessage;
}

/** Move the message breakpoint to the newest message, so everything before it is read from cache next time. */
export function markLastMessage(messages: ModelMessage[]): ModelMessage[] {
  if (messages.length === 0) return messages;
  const cleaned = messages.map(withoutBreakpoint);
  const last = cleaned[cleaned.length - 1];
  cleaned[cleaned.length - 1] = {
    ...last,
    providerOptions: { ...last.providerOptions, anthropic: { ...last.providerOptions?.anthropic, ...BREAKPOINT.anthropic } },
  } as ModelMessage;
  return cleaned;
}

/** Tool definitions are part of the cached prefix; sort them so parallel MCP connections can't reorder them. */
export function stableTools(tools: ToolSet): ToolSet {
  return Object.fromEntries(Object.entries(tools).sort(([a], [b]) => a.localeCompare(b)));
}
