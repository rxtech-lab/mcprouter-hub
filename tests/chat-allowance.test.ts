import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: vi.fn(), quota: vi.fn(), entitlements: vi.fn(), configured: true,
  config: { enabled: true, usageItem: "mcp_calls", chatUsageItem: "chat", premiumUsageItem: "premium_mcp" },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/free-chat", () => ({ currentFreeChatQuota: mocks.quota }));
vi.mock("@/lib/billing/config", () => ({ billingConfig: mocks.config }));
vi.mock("@/lib/billing/subscription", () => ({ getEntitlements: mocks.entitlements, get subscriptionConfigured() { return mocks.configured; } }));
import { currentChatAllowance } from "@/lib/chat-allowance";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured = true;
  mocks.user.mockResolvedValue({ id: "member-1" });
  mocks.entitlements.mockResolvedValue({ balances: [
    { unit: "mcp-calls", name: "MCP credits", available: 123, amount: 150 },
    { unit: "chat", name: "Chat credits", available: 8 },
    { unit: "other", name: "Other credits", available: 999 },
  ], usage: [{ key: "chat", used: 2, limit: 10, remaining: 8, resetsAt: "2026-10-22T00:00:00Z" }, { key: "mcp_calls", used: 4, limit: 15, remaining: 11, resetsAt: "2026-10-21T00:00:00Z" }, { key: "premium_mcp", used: 3, limit: 5, remaining: 2, resetsAt: null }] });
});

describe("chat allowance", () => {
  it("shows the visitor's shared daily quota without querying member credits", async () => {
    mocks.user.mockResolvedValue(null);
    mocks.quota.mockResolvedValue({ remaining: 7, limit: 15 });
    expect(await currentChatAllowance()).toEqual({ kind: "guest", quota: { remaining: 7, limit: 15 } });
    expect(mocks.entitlements).not.toHaveBeenCalled();
  });
  it("uses actual usage limits instead of stored balances for the signed-in identity", async () => {
    expect(await currentChatAllowance()).toMatchObject({ kind: "member", billing: "ready", chatAllowance: { used: 2, remaining: 8, limit: 10 }, allowance: { used: 4, remaining: 11, limit: 15 }, premiumAllowance: { used: 3, remaining: 2, limit: 5 } });
    expect(mocks.entitlements).toHaveBeenCalledWith({ id: "member-1" });
    expect(mocks.quota).not.toHaveBeenCalled();
  });
  it("distinguishes unavailable balances from a real zero balance", async () => {
    mocks.entitlements.mockRejectedValue(new Error("offline"));
    expect(await currentChatAllowance()).toMatchObject({ billing: "unavailable", allowance: null });
    mocks.configured = false;
    expect(await currentChatAllowance()).toMatchObject({ billing: "unconfigured" });
  });
  it("preserves unlimited allowances and zero remaining, without treating absent usage as unlimited", async () => {
    mocks.entitlements.mockResolvedValueOnce({ balances: [], usage: [{ key: "mcp_calls", used: 100, limit: null, remaining: null }] });
    expect(await currentChatAllowance()).toMatchObject({ allowance: { limit: null, remaining: null } });
    mocks.entitlements.mockResolvedValueOnce({ balances: [], usage: [{ key: "mcp_calls", used: 10, limit: 10, remaining: 0 }] });
    expect(await currentChatAllowance()).toMatchObject({ allowance: { limit: 10, remaining: 0 } });
    mocks.entitlements.mockResolvedValueOnce({ balances: [], usage: [] });
    expect(await currentChatAllowance()).toMatchObject({ billing: "ready", allowance: null, premiumAllowance: null });
  });
});
