import { waitUntil } from "@vercel/functions";
import { ZodError } from "zod";
import { incrementCallCount } from "@/lib/api-keys";
import { billingConfig, mcpUsageItem } from "@/lib/billing/config";
import { UsageLimitError } from "@/lib/billing/errors";
import { recordUsage } from "@/lib/billing/subscription";
import { logToolCall, type ToolCallLog } from "@/lib/usage";
import type { CallerContext } from "@/lib/mcp/types";

export type McpToolResponse = {
  content: Array<{ type: "text"; text: string }>;
  /** For MCP Apps; the model only sees `content`. */
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

type Dependencies = {
  record: typeof recordUsage;
  increment: (apiKeyId: string) => Promise<unknown>;
  log: (entry: ToolCallLog) => Promise<unknown>;
  billingEnabled: boolean;
  defer: (promise: Promise<unknown>) => void;
};

const defaultDependencies: Dependencies = {
  record: recordUsage,
  increment: incrementCallCount,
  log: logToolCall,
  billingEnabled: billingConfig.enabled,
  defer: (promise) => waitUntil(promise),
};

function text(value: string, isError = false): McpToolResponse {
  return { content: [{ type: "text", text: value }], ...(isError ? { isError: true } : {}) };
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
}

function limitMessage(error: UsageLimitError) {
  const billing = `${siteUrl()}/billing`;
  const name = error.item === billingConfig.premiumUsageItem ? "premium MCP" : "MCP";
  if (error.reason === "insufficient_balance") {
    return `You're out of ${name} call credits. Top up at ${billing} to keep using mcprouter.`;
  }
  const used = error.limit === null ? "" : ` (${error.used ?? error.limit}/${error.limit} calls used)`;
  const resets = error.resetsAt ? ` It resets ${new Date(error.resetsAt).toUTCString()}.` : "";
  return `Your plan's ${name} call allowance is used up${used}.${resets} Review your plan at ${billing} to keep using mcprouter.`;
}

/**
 * Gate each billable call through RxSubscription's usage API, which alone decides
 * allowances and overage charges. News uses a separate premium meter even during
 * chat. Ordinary tools are included in an already metered chat message.
 */
export async function meterToolCall(
  caller: CallerContext,
  { structured, ...call }: { service: string; tool: string; structured?: (value: unknown) => Record<string, unknown> },
  run: () => Promise<unknown>,
  dependencies: Partial<Dependencies> = {},
): Promise<McpToolResponse> {
  const deps = { ...defaultDependencies, ...dependencies };
  const startedAt = Date.now();
  const log = (status: ToolCallLog["status"], errorCode: string | null = null) =>
    deps.defer(
      deps
        .log({
          userId: caller.userId,
          apiKeyId: caller.apiKeyId,
          channel: caller.channel ?? null,
          oauthClientId: caller.oauthClientId ?? null,
          ...call,
          status,
          errorCode,
          latencyMs: Date.now() - startedAt,
        })
        .catch((error) => console.error("[meter] failed to log tool call", error)),
    );

  const item = mcpUsageItem(call.service);
  const premium = item === billingConfig.premiumUsageItem;
  if (deps.billingEnabled && caller.guest && premium) {
    log("denied", "premium_requires_account");
    return text(`Sign in and review your premium MCP allowance at ${siteUrl()}/billing to use news tools.`, true);
  }
  if (deps.billingEnabled && !caller.guest && (premium || !(caller.chatMetered && !caller.apiKeyId))) {
    const idempotencyKey = `mcp:${caller.userId}:${crypto.randomUUID()}`;
    const metadata = { service: call.service, tool: call.tool, apiKeyId: caller.apiKeyId, channel: caller.channel ?? null };
    try {
      await deps.record({ rxlabUserId: caller.userId, item, idempotencyKey, metadata });
    } catch (error) {
      if (error instanceof UsageLimitError) {
        log("denied", error.reason);
        return text(limitMessage(error), true);
      }
      console.error("[meter] rx-subscription usage check failed", error);
      log("denied", "billing_unavailable");
      return text("Billing is temporarily unavailable, so the call was not made. Please try again shortly.", true);
    }
  }

  if (caller.apiKeyId) {
    deps.defer(deps.increment(caller.apiKeyId).catch((error) => console.error("[meter] failed to count tool call", error)));
  }

  try {
    const value = await run();
    const result = text(JSON.stringify(value));
    if (structured) result.structuredContent = structured(value);
    log("ok");
    return result;
  } catch (error) {
    if (error instanceof ZodError) {
      log("error", "invalid_input");
      return text(`Invalid input: ${error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ")}`, true);
    }
    log("error", (error as { code?: string }).code ?? "tool_failed");
    return text((error as Error).message || "The tool failed", true);
  }
}
