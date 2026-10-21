import { UsageLimitError } from "@/lib/billing/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ charge: vi.fn(), user: vi.fn(), stream: vi.fn(), quota: vi.fn(), cookies: vi.fn(), config: vi.fn() }));
vi.mock("@/lib/billing/chat", async (original) => ({ ...await original<typeof import("@/lib/billing/chat")>(), consumeChatMessage: mocks.charge }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/agent/run", () => ({ streamAgentReply: mocks.stream }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/free-chat", async (original) => ({
  ...await original<typeof import("@/lib/free-chat")>(), consumeFreeMessage: mocks.quota, freeChatConfig: mocks.config,
}));
import { POST } from "@/app/api/free-chat/route";

const message = { id: "question", role: "user", parts: [{ type: "text", text: "What's the weather?" }] };
const request = () => POST(new Request("https://catalogue.test/api/free-chat", { method: "POST", body: JSON.stringify({ messages: [message] }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.charge.mockResolvedValue(undefined);
  vi.stubEnv("MCPROUTER_INTERNAL_KEY", "test-key");
  mocks.user.mockResolvedValue({ id: "member-1" });
  mocks.stream.mockResolvedValue(new Response("stream"));
  mocks.config.mockReturnValue({ enabled: true, dailyLimit: 15, ipDailyLimit: 60, model: "test-model" });
  mocks.cookies.mockResolvedValue({ get: () => ({ value: "visitor-1" }), set: vi.fn() });
  mocks.quota.mockResolvedValue({ allowed: true, quota: { remaining: 14, limit: 15 } });
});

describe("landing chat session contract", () => {
  it("meters members under their session without consuming guest messages or setting a guest cookie", async () => {
    expect((await request()).status).toBe(200);
    const options = mocks.stream.mock.calls[0][0];
    expect(options.servers[0].headers).toMatchObject({ "x-mcprouter-user": "member-1", "x-mcprouter-channel": "web" });
    expect(options.headers.has("x-free-chat-remaining")).toBe(false);
    expect(mocks.quota).not.toHaveBeenCalled();
    expect(mocks.cookies).not.toHaveBeenCalled();
  });
  it("continues to cap signed-out visitors with the shared guest quota", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await request()).status).toBe(200);
    expect(mocks.quota.mock.calls[0][0].guest).toBe("guest:visitor-1");
    expect(mocks.stream.mock.calls[0][0].headers.get("x-free-chat-remaining")).toBe("14");
    mocks.quota.mockResolvedValue({ allowed: false, quota: { remaining: 0, limit: 15 } });
    expect((await request()).status).toBe(429);
    expect(mocks.stream).toHaveBeenCalledTimes(1);
  });
  it("applies the free-chat flag to guests while allowing signed-in requests", async () => {
    mocks.config.mockReturnValue({ enabled: false, model: "test-model" });
    expect((await request()).status).toBe(200);
    mocks.user.mockResolvedValue(null);
    expect((await request()).status).toBe(404);
  });
});

it("refuses chat before invoking the agent when rx-subscription denies or is unavailable", async () => {
  mocks.charge.mockRejectedValueOnce(new UsageLimitError("chat", "limit_exceeded", 10, 10));
  expect((await request()).status).toBe(402);
  expect(mocks.stream).not.toHaveBeenCalled();
  mocks.charge.mockRejectedValueOnce(new Error("offline"));
  expect((await request()).status).toBe(503);
  expect(mocks.stream).not.toHaveBeenCalled();
});

it("records the latest user message under the authenticated account", async () => {
  expect((await request()).status).toBe(200);
  expect(mocks.charge).toHaveBeenCalledExactlyOnceWith({ userId: "member-1", messageId: "question", channel: "web" });
  expect(mocks.stream.mock.calls[0][0].servers[0].headers["x-mcprouter-chat-metered"]).toBe("1");
});
