import { setTimeout as delay } from "node:timers/promises";

export const SCHEDULED_MCP_NOTE = "A failed MCP call is not the end of this task. MCP calls are retried up to three attempts automatically. Inspect error results, correct arguments or use alternative tools, and keep making tool calls until every requested part is finished or access is genuinely blocked. Do not repeat successful actions. Before retrying a write with an uncertain outcome, verify whether it already completed. Report any unfinished parts clearly; never invent missing results.";

export function mcpErrorResult(error: unknown) {
  return { isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : "MCP call failed" }] };
}

function isErrorResult(value: unknown): value is { isError: true } {
  return !!value && typeof value === "object" && "isError" in value && value.isError === true;
}

/** Retry a single operation, never the workflow; cancellation still terminates the run. */
export async function retryMcp<T>(operation: () => Promise<T>, signal: AbortSignal, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    signal.throwIfAborted();
    try {
      const result = await operation();
      signal.throwIfAborted();
      if (!isErrorResult(result) || attempt >= attempts) return result;
    } catch (error) {
      signal.throwIfAborted();
      const status = error && typeof error === "object" && "statusCode" in error ? error.statusCode : undefined;
      if (attempt >= attempts || [400, 401, 403, 404, 422].includes(Number(status))) throw error;
    }
    await delay(500 * 2 ** (attempt - 1), undefined, { signal });
  }
}
