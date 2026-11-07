import { beforeEach, describe, expect, it, vi } from "vitest";
import { setTimeout as delay } from "node:timers/promises";
import { retryMcp } from "@/lib/agent/mcp-retry";

vi.mock("node:timers/promises", () => ({ setTimeout: vi.fn(async () => {}) }));
beforeEach(() => vi.clearAllMocks());

describe("scheduled MCP retries", () => {
  it("retries MCP error results with exponential backoff", async () => {
    const operation = vi.fn().mockResolvedValueOnce({ isError: true }).mockResolvedValueOnce({ isError: true }).mockResolvedValue({ content: [] });
    const result = retryMcp(operation, new AbortController().signal);
    await expect(result).resolves.toEqual({ content: [] });
    expect(operation).toHaveBeenCalledTimes(3);
    expect(vi.mocked(delay).mock.calls.map(call => call[0])).toEqual([500, 1000]);
  });

  it("returns the final MCP error result after three attempts", async () => {
    const operation = vi.fn().mockResolvedValue({ isError: true, content: [] });
    const result = retryMcp(operation, new AbortController().signal);
    await expect(result).resolves.toEqual({ isError: true, content: [] });
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not retry a rejected authentication request", async () => {
    const error = Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    const operation = vi.fn().mockRejectedValue(error);
    await expect(retryMcp(operation, new AbortController().signal)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledOnce();
  });

  it("cancels backoff without another call", async () => {
    const controller = new AbortController();
    const operation = vi.fn().mockRejectedValue(new Error("Network failure"));
    const result = retryMcp(operation, controller.signal);
    const assertion = expect(result).rejects.toThrow();
    await Promise.resolve();
    controller.abort();
    await assertion;
    expect(operation).toHaveBeenCalledOnce();
  });
});
