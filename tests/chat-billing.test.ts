import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsageLimitError } from "@/lib/billing/errors";

const mocks = vi.hoisted(() => ({ debit: vi.fn(), record: vi.fn(), config: { enabled: true, chatCreditUnit: "chat" } }));
vi.mock("@/lib/billing/config", () => ({ billingConfig: mocks.config }));
vi.mock("@/lib/billing/subscription", () => ({ debitBalance: mocks.debit, recordUsage: mocks.record }));
import { consumeChatMessage, DuplicateChatMessageError } from "@/lib/billing/chat";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.enabled = true;
  mocks.debit.mockResolvedValue({ duplicate: false, balanceAfter: 0 });
});

describe("chat balance gate", () => {
  it.each(["web", "telegram", "whatsapp"] as const)("debits exactly one chat unit before a %s message", async (channel) => {
    await consumeChatMessage({ userId: "member", messageId: "message-1", channel });
    expect(mocks.debit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ rxlabUserId: "member", unit: "chat", amount: 1, metadata: { channel } }));
    // Recording usage as well could charge overage a second time.
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("refuses a zero balance without consulting an unlimited plan allowance", async () => {
    mocks.debit.mockRejectedValue(new UsageLimitError("chat", "insufficient_balance", null, null));
    await expect(consumeChatMessage({ userId: "member", messageId: "message-1", channel: "web" })).rejects.toMatchObject({ reason: "insufficient_balance" });
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("uses a stable debit key and refuses duplicate agent runs", async () => {
    const input = { userId: "member", messageId: "message-1", channel: "web" as const };
    await consumeChatMessage(input);
    mocks.debit.mockResolvedValue({ duplicate: true, balanceAfter: 0 });
    await expect(consumeChatMessage(input)).rejects.toBeInstanceOf(DuplicateChatMessageError);
    expect(mocks.debit.mock.calls[0][0].idempotencyKey).toBe(mocks.debit.mock.calls[1][0].idempotencyKey);
  });

  it("does not call billing when metering is disabled", async () => {
    mocks.config.enabled = false;
    await consumeChatMessage({ userId: "member", messageId: "message-1", channel: "web" });
    expect(mocks.debit).not.toHaveBeenCalled();
  });
});
