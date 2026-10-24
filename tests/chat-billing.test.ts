import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsageLimitError } from "@/lib/billing/errors";

const mocks = vi.hoisted(() => ({ debit: vi.fn(), record: vi.fn(), config: { enabled: true, chatUsageItem: "chat" } }));
vi.mock("@/lib/billing/config", () => ({ billingConfig: mocks.config }));
vi.mock("@/lib/billing/subscription", () => ({ debitBalance: mocks.debit, recordUsage: mocks.record }));
import { consumeChatMessage, DuplicateChatMessageError } from "@/lib/billing/chat";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.enabled = true;
  mocks.record.mockResolvedValue({ duplicate: false, allowed: true, used: 1, limit: 50, remaining: 49 });
});

describe("chat usage gate", () => {
  it.each(["web", "telegram", "whatsapp"] as const)("records exactly one chat event before a %s message", async (channel) => {
    await consumeChatMessage({ userId: "member", messageId: "message-1", channel });
    expect(mocks.record).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ rxlabUserId: "member", item: "chat", amount: 1, metadata: { channel } }));
    // Only the usage API may decide whether to debit overage.
    expect(mocks.debit).not.toHaveBeenCalled();
  });

  it("refuses an exhausted usage allowance", async () => {
    mocks.record.mockRejectedValue(new UsageLimitError("chat", "limit_exceeded", 50, 50));
    await expect(consumeChatMessage({ userId: "member", messageId: "message-1", channel: "web" })).rejects.toMatchObject({ reason: "limit_exceeded" });
    expect(mocks.debit).not.toHaveBeenCalled();
  });

  it("uses a stable usage key and refuses duplicate agent runs", async () => {
    const input = { userId: "member", messageId: "message-1", channel: "web" as const };
    await consumeChatMessage(input);
    mocks.record.mockResolvedValue({ duplicate: true, allowed: true, used: 1, limit: 50, remaining: 49 });
    await expect(consumeChatMessage(input)).rejects.toBeInstanceOf(DuplicateChatMessageError);
    expect(mocks.record.mock.calls[0][0].idempotencyKey).toBe(mocks.record.mock.calls[1][0].idempotencyKey);
  });

  it("does not call billing when metering is disabled", async () => {
    mocks.config.enabled = false;
    await consumeChatMessage({ userId: "member", messageId: "message-1", channel: "web" });
    expect(mocks.debit).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });
});
