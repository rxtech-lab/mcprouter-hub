import type { ToolInput } from "@/lib/mcp/types";

export type Case = {
  /** Test name; defaults to the tool name. */
  name?: string;
  tool: string;
  input: ToolInput;
  /** Expected upstream request. Omit for tools that never call out. */
  request?: { url: string; method?: "GET" | "POST"; body?: unknown };
  /** Upstream reply: objects are sent as JSON, strings as-is. */
  reply?: unknown;
  /** Replies to follow-up requests a transformer makes, by URL. */
  lookups?: Record<string, unknown>;
  /** Expected `data` of the tool result. */
  data?: unknown;
  /** Expected `meta` of the tool result (`source` is checked separately). */
  meta?: Record<string, unknown>;
  /** Expected cache TTL in seconds for the upstream body. */
  ttl?: number;
  /** Expected error instead of a result. */
  error?: RegExp;
};
