import { waitUntil } from "@vercel/functions";
import { ZodError } from "zod";
import { incrementCallCount } from "@/lib/api-keys";
import { billingConfig } from "@/lib/billing/config";
import { UsageLimitError } from "@/lib/billing/errors";
import { debitBalance, recordUsage } from "@/lib/billing/subscription";
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
  debit: typeof debitBalance;
  increment: (apiKeyId: string) => Promise<unknown>;
  log: (entry: ToolCallLog) => Promise<unknown>;
  billingEnabled: boolean;
  /** Balance unit each call is paid from. Unset leaves the plan allowance as the only gate. */
  creditUnit: string | undefined;
  defer: (promise: Promise<unknown>) => void;
};

const defaultDependencies: Dependencies = {
  record: recordUsage,
  debit: debitBalance,
  increment: incrementCallCount,
  log: logToolCall,
  billingEnabled: billingConfig.enabled,
  creditUnit: billingConfig.creditUnit,
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
  if (error.reason === "insufficient_balance") {
    return `You're out of MCP call credits. Top up at ${billing} to keep using mcprouter.`;
  }
  const used = error.limit === null ? "" : ` (${error.used ?? error.limit}/${error.limit} calls used)`;
  const resets = error.resetsAt ? ` It resets ${new Date(error.resetsAt).toUTCString()}.` : "";
  return `Your plan's MCP call allowance is used up${used}.${resets} Switch to Pay as you go at ${billing} to keep using mcprouter.`;
}

/**
 * Wraps one MCP tool call: pay for it from the caller's credit balance first
 * (or, with no credit unit configured, charge it against the plan allowance),
 * run it, then bump the key's call counter and log the call by tool for the
 * usage page. With a credit unit the usage item only tracks the call.
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
        .log({ userId: caller.userId, apiKeyId: caller.apiKeyId, ...call, status, errorCode, latencyMs: Date.now() - startedAt })
        .catch((error) => console.error("[meter] failed to log tool call", error)),
    );

  // The free agent has its own daily message limit; its tool calls are not charged to anyone.
  if (deps.billingEnabled && !caller.guest) {
    const idempotencyKey = `mcp:${caller.userId}:${crypto.randomUUID()}`;
    const metadata = { service: call.service, tool: call.tool, apiKeyId: caller.apiKeyId };
    const record = () => deps.record({ rxlabUserId: caller.userId, item: billingConfig.usageItem, idempotencyKey, metadata });
    try {
      if (deps.creditUnit) {
        await deps.debit({ rxlabUserId: caller.userId, unit: deps.creditUnit, idempotencyKey, description: call.tool, metadata });
        deps.defer(record().catch((error) => console.error("[meter] failed to track usage", error)));
      } else {
        await record();
      }
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
