import { UsageLimitError } from "@/lib/billing/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiChatScope } from "@/lib/agent/api-scope";

const mocks = vi.hoisted(() => ({
  charge: vi.fn(), user: vi.fn(), stream: vi.fn(), quota: vi.fn(), cookies: vi.fn(), config: vi.fn(),
}));
vi.mock("@/lib/billing/chat", async (original) => ({ ...await original<typeof import("@/lib/billing/chat")>(), consumeChatMessage: mocks.charge }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/agent/run", () => ({ streamAgentReply: mocks.stream }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/free-chat", async (original) => ({
  ...await original<typeof import("@/lib/free-chat")>(), consumeFreeMessage: mocks.quota, freeChatConfig: mocks.config,
}));
import { POST } from "@/app/api/provider-chat/route";

function request(body: unknown) {
  return POST(new Request("https://catalogue.test/api/provider-chat", { method: "POST", body: JSON.stringify(body) }));
}
const message = { id: "question", role: "user", parts: [{ type: "text", text: "When is the next train?" }] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.charge.mockResolvedValue(undefined);
  vi.stubEnv("MCPROUTER_INTERNAL_KEY", "test-internal-key");
  vi.stubEnv("AGENT_MCP_SERVERS", '[{"name":"unrelated","url":"https://external.test/mcp"}]');
  mocks.user.mockResolvedValue({ id: "member-1" });
  mocks.stream.mockResolvedValue(new Response("stream"));
  mocks.config.mockReturnValue({ enabled: true, dailyLimit: 15, ipDailyLimit: 60, model: "test-model" });
  mocks.cookies.mockResolvedValue({ get: () => ({ value: "guest-1" }), set: vi.fn() });
  mocks.quota.mockResolvedValue({ allowed: true, quota: { remaining: 14 } });
});

describe("catalogue chat contract", () => {
  it("rejects unknown, missing and unimplemented APIs before invoking the agent", async () => {
    for (const apiId of [undefined, "API-999999", {}, "API-0022"]) {
      expect((await request({ apiId, messages: [message] })).status).toBe(400);
    }
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(mocks.quota).not.toHaveBeenCalled();
  });

  it("rejects malformed messages and oversized questions", async () => {
    for (const messages of [[], [{}], [{ ...message, role: "assistant" }]]) {
      expect((await request({ apiId: "API-0014", messages })).status).toBe(400);
    }
    expect((await request({ apiId: "API-0014", messages: [{ ...message, parts: [{ type: "text", text: "x".repeat(2001) }] }] })).status).toBe(413);
    expect((await request(null)).status).toBe(400);
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("derives scope from the catalogue and ignores browser-supplied tools and external servers", async () => {
    const scope = apiChatScope("API-0014")!;
    expect(scope.tools.some((tool) => tool.name === "mtr_next_train")).toBe(true);
    expect((await request({ apiId: "API-0014", messages: [message], scopes: ["hko"], tools: ["hko_current_weather"] })).status).toBe(200);
    const options = mocks.stream.mock.calls[0][0];
    expect(options.servers).toHaveLength(1);
    expect(options.servers[0]).toMatchObject({ self: true, toolMode: "all", headers: {
      "x-mcprouter-user": "member-1", "x-mcprouter-scopes": scope.services.join(","), "x-mcprouter-tools": "all",
    } });
    expect(options.toolScope).toEqual(scope.tools.map((tool) => tool.name));
    expect(options.toolScope).not.toContain("hko_current_weather");
    expect(options.channelTools).toBeUndefined();
    expect(mocks.quota).not.toHaveBeenCalled();
  });

  it("uses the existing guest identity and shared quota", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await request({ apiId: "API-0014", messages: [message] })).status).toBe(200);
    expect(mocks.quota.mock.calls[0][0].guest).toBe("guest:guest-1");
    expect(mocks.stream.mock.calls[0][0].servers[0].headers["x-mcprouter-user"]).toBe("guest:guest-1");
    mocks.quota.mockResolvedValue({ allowed: false, quota: { remaining: 0 } });
    expect((await request({ apiId: "API-0014", messages: [message] })).status).toBe(429);
    expect(mocks.stream).toHaveBeenCalledTimes(1);
  });

  it("respects the guest feature flag and fails closed without MCP credentials", async () => {
    mocks.user.mockResolvedValue(null);
    mocks.config.mockReturnValue({ enabled: false });
    expect((await request({ apiId: "API-0014", messages: [message] })).status).toBe(403);
    mocks.user.mockResolvedValue({ id: "member-1" });
    vi.stubEnv("MCPROUTER_INTERNAL_KEY", "");
    expect((await request({ apiId: "API-0014", messages: [message] })).status).toBe(503);
    expect(mocks.quota).not.toHaveBeenCalled();
    expect(mocks.stream).not.toHaveBeenCalled();
  });
});

describe("service-page chat contract", () => {
  it("limits a service chat to that service's own tools", async () => {
    expect((await request({ serviceId: "td-street-parking", messages: [message] })).status).toBe(200);
    const options = mocks.stream.mock.calls[0][0];
    expect(options.servers[0].headers["x-mcprouter-scopes"]).toBe("td-street-parking");
    expect(options.toolScope).toContain("parking_meter_vacancy");
    expect(options.toolScope).not.toContain("hko_current_weather");
    expect(options.servers).toHaveLength(1);
  });
  it("rejects unknown services and ambiguous API/service selections", async () => {
    expect((await request({ serviceId: "not-a-service", messages: [message] })).status).toBe(400);
    expect((await request({ serviceId: "td-street-parking", apiId: "API-0014", messages: [message] })).status).toBe(400);
    expect(mocks.stream).not.toHaveBeenCalled();
  });
});

it("refuses chat before invoking the agent when rx-subscription denies or is unavailable", async () => {
  mocks.charge.mockRejectedValueOnce(new UsageLimitError("chat", "limit_exceeded", 10, 10));
  expect((await request({ apiId: "API-0014", messages: [message] })).status).toBe(402);
  expect(mocks.stream).not.toHaveBeenCalled();
  mocks.charge.mockRejectedValueOnce(new Error("offline"));
  expect((await request({ apiId: "API-0014", messages: [message] })).status).toBe(503);
  expect(mocks.stream).not.toHaveBeenCalled();
});

it("records the latest user message under the authenticated account", async () => {
  expect((await request({ apiId: "API-0014", messages: [message] })).status).toBe(200);
  expect(mocks.charge).toHaveBeenCalledExactlyOnceWith({ userId: "member-1", messageId: "question", channel: "web" });
  expect(mocks.stream.mock.calls[0][0].servers[0].headers["x-mcprouter-chat-metered"]).toBe("1");
});
