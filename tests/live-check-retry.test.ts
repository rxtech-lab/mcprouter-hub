import { afterEach, expect, it, vi } from "vitest";
import { retryCheck } from "@/scripts/live-check-retry";

afterEach(() => vi.useRealTimers());

it("retries a transient failure with backoff and returns the successful result", async () => {
  vi.useFakeTimers();
  const check = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockRejectedValueOnce(new Error("503")).mockResolvedValue({ data: "healthy" });
  const onRetry = vi.fn();
  const pending = retryCheck(check, { attempts: 3, delayMs: 2000, onRetry });
  await vi.runAllTimersAsync();
  expect(await pending).toEqual({ value: { data: "healthy" }, attempts: 3 });
  expect(check).toHaveBeenCalledTimes(3);
  expect(onRetry.mock.calls.map(([attempt, , delay]) => [attempt, delay])).toEqual([[1, 2000], [2, 4000]]);
});

it("stops at the configured limit and propagates the final error", async () => {
  vi.useFakeTimers();
  const error = new Error("upstream unavailable");
  const check = vi.fn().mockRejectedValue(error);
  const onRetry = vi.fn();
  const pending = expect(retryCheck(check, { attempts: 2, delayMs: 2000, onRetry })).rejects.toBe(error);
  await vi.runAllTimersAsync();
  await pending;
  expect(check).toHaveBeenCalledTimes(2);
  expect(onRetry).toHaveBeenCalledTimes(1);
});
