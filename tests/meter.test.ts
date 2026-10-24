import { afterEach, describe, expect, it, vi } from "vitest";
import { UsageLimitError } from "@/lib/billing/errors";
import { recordUsage } from "@/lib/billing/subscription";
import { UpstreamError } from "@/lib/mcp/fetcher";
import { meterToolCall } from "@/lib/mcp/meter";

const caller = { userId: "user-1", apiKeyId: "key-1", scopes: [] };
const call = { service: "kmb", tool: "kmb_stop_eta" };

function deps(overrides: Partial<Parameters<typeof meterToolCall>[3]> = {}) {
  const deferred: Promise<unknown>[] = [];
  const value = {
    record: vi.fn(async () => ({ allowed: true, used: 1, limit: 100, remaining: 99, chargedUnits: 0, periodEnd: null, duplicate: false })),
    increment: vi.fn(async () => {}),
    log: vi.fn(async () => {}),
    billingEnabled: true,
    defer: (promise: Promise<unknown>) => void deferred.push(promise),
    ...overrides,
  };
  return { value, settle: () => Promise.all(deferred) };
}

describe("meterToolCall", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("charges, runs and counts a successful call", async () => {
    const { value, settle } = deps();
    const result = await meterToolCall(caller, call, async () => ({ eta: 3 }), value);
    await settle();
    expect(result).toEqual({ content: [{ type: "text", text: '{"eta":3}' }] });
    expect(value.record).toHaveBeenCalledWith(expect.objectContaining({ rxlabUserId: "user-1", item: "mcp_calls", metadata: { ...call, apiKeyId: "key-1", channel: null } }));
    expect(value.increment).toHaveBeenCalledWith("key-1");
    expect(value.log).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", apiKeyId: "key-1", ...call, status: "ok", errorCode: null }));
  });

  it("logs the channel and OAuth client the call came from", async () => {
    const { value, settle } = deps();
    await meterToolCall({ userId: "user-1", apiKeyId: null, scopes: [], channel: "oauth", oauthClientId: "client-1" }, call, async () => ({}), value);
    await settle();
    expect(value.log).toHaveBeenCalledWith(expect.objectContaining({ channel: "oauth", oauthClientId: "client-1", status: "ok" }));
  });

  it("never charges free-agent guests", async () => {
    const { value } = deps();
    const result = await meterToolCall({ userId: "guest:abc", apiKeyId: null, scopes: [], guest: true }, call, async () => ({ eta: 3 }), value);
    expect(result.isError).toBeUndefined();
    expect(value.record).not.toHaveBeenCalled();
    expect(value.increment).not.toHaveBeenCalled();
  });

  it.each(["web", "telegram", "whatsapp"] as const)("includes tools in a metered %s chat message", async (channel) => {
    const { value, settle } = deps();
    const result = await meterToolCall({ userId: "member", apiKeyId: null, scopes: [], channel, chatMetered: true }, call, async () => ({ eta: 3 }), value);
    await settle();
    expect(result.isError).toBeUndefined();
    expect(value.record).not.toHaveBeenCalled();
    expect(value.log).toHaveBeenCalledWith(expect.objectContaining({ userId: "member", channel, status: "ok" }));
  });

  it("still bills an API-key caller claiming to be a metered chat", async () => {
    const { value } = deps();
    await meterToolCall({ ...caller, chatMetered: true }, call, async () => ({}), value);
    expect(value.record).toHaveBeenCalledOnce();
  });

  it("refuses the call when the plan's allowance is used up", async () => {
    const run = vi.fn();
    const { value } = deps({ record: vi.fn(async () => { throw new UsageLimitError("mcp_calls", "limit_exceeded", 1000, 1000); }) });
    const result = await meterToolCall(caller, call, run, value);
    expect(run).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/allowance is used up \(1000\/1000 calls used\).*\/billing/);
    expect(value.increment).not.toHaveBeenCalled();
    expect(value.log).toHaveBeenCalledWith(expect.objectContaining({ status: "denied", errorCode: "limit_exceeded" }));
  });

  it("asks for a top-up when pay-as-you-go credits run out", async () => {
    const run = vi.fn();
    const { value } = deps({ record: vi.fn(async () => { throw new UsageLimitError("mcp_calls", "insufficient_balance", 0, 0); }) });
    const result = await meterToolCall(caller, call, run, value);
    expect(run).not.toHaveBeenCalled();
    expect(result.content[0].text).toMatch(/out of MCP call credits.*\/billing/);
  });

  it("fails closed when rx-subscription is unreachable", async () => {
    const run = vi.fn();
    const { value } = deps({ record: vi.fn(async () => { throw new Error("ECONNREFUSED"); }) });
    const result = await meterToolCall(caller, call, run, value);
    expect(run).not.toHaveBeenCalled();
    expect(result.content[0].text).toMatch(/Billing is temporarily unavailable/);
  });

  it.each(["list_top_news", "get_news_detail", "search_news", "scrape_website"])("records %s only against the premium meter", async (tool) => {
    const { value, settle } = deps();
    const result = await meterToolCall(caller, { service: "unified-news", tool }, async () => ({ ok: true }), value);
    await settle();
    expect(result.isError).toBeUndefined();
    expect(value.record).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ rxlabUserId: "user-1", item: "premium_mcp" }));
  });

  it("refuses premium calls before execution when their allowance is exhausted", async () => {
    const run = vi.fn();
    const { value } = deps({ record: vi.fn(async () => { throw new UsageLimitError("premium_mcp", "limit_exceeded", 10, 10); }) });
    const result = await meterToolCall(caller, { service: "unified-news", tool: "search_news" }, run, value);
    expect(run).not.toHaveBeenCalled();
    expect(result.content[0].text).toMatch(/premium MCP call allowance.*\/billing/);
  });

  it.each(["web", "telegram", "whatsapp"] as const)("meters premium tools separately during %s chat", async (channel) => {
    const { value, settle } = deps();
    const result = await meterToolCall({ userId: "member", apiKeyId: null, scopes: [], chatMetered: true, channel }, { service: "unified-news", tool: "get_news_detail" }, async () => ({}), value);
    await settle();
    expect(result.isError).toBeUndefined();
    expect(value.record).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ item: "premium_mcp" }));
  });

  it("requires an account for premium guest calls", async () => {
    const { value } = deps();
    const run = vi.fn();
    const result = await meterToolCall({ userId: "guest", apiKeyId: null, scopes: [], guest: true }, { service: "unified-news", tool: "search_news" }, run, value);
    expect(result.isError).toBe(true);
    expect(run).not.toHaveBeenCalled();
    expect(value.record).not.toHaveBeenCalled();
  });

  it("skips metering when billing is disabled and returns upstream errors", async () => {
    const { value, settle } = deps({ billingEnabled: false });
    const result = await meterToolCall(caller, call, async () => { throw new UpstreamError("upstream_timeout", "too slow"); }, value);
    await settle();
    expect(value.record).not.toHaveBeenCalled();
    expect(result).toEqual({ content: [{ type: "text", text: "too slow" }], isError: true });
    expect(value.increment).toHaveBeenCalledWith("key-1");
    expect(value.log).toHaveBeenCalledWith(expect.objectContaining({ status: "error", errorCode: "upstream_timeout" }));
  });
});

describe("recordUsage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("maps a 402 from rx-subscription to UsageLimitError", async () => {
    vi.stubEnv("RX_SUBSCRIPTION_URL", "https://subs.test/");
    vi.stubEnv("RX_SUBSCRIPTION_API_KEY", "secret");
    const fetchMock = vi.fn(async () => Response.json({ allowed: false, reason: "limit_exceeded", used: 50, limit: 50 }, { status: 402 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(recordUsage({ rxlabUserId: "u", item: "mcp_tool_call", idempotencyKey: "k" })).rejects.toMatchObject({ reason: "limit_exceeded", used: 50, limit: 50 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("https://subs.test/api/v1/usage");
    expect(init.headers).toMatchObject({ "X-Api-Key": "secret" });
    expect(JSON.parse(String(init.body))).toMatchObject({ rxlabUserId: "u", item: "mcp_tool_call", amount: 1, idempotencyKey: "k" });
  });

  it("keeps the reason when pay-as-you-go credits can't cover the call", async () => {
    vi.stubEnv("RX_SUBSCRIPTION_URL", "https://subs.test");
    vi.stubEnv("RX_SUBSCRIPTION_API_KEY", "secret");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ allowed: false, reason: "insufficient_balance", used: 0, limit: 0 }, { status: 402 })));
    const error = await recordUsage({ rxlabUserId: "u", item: "mcp_calls", idempotencyKey: "k" }).catch((caught) => caught);
    expect(error).toBeInstanceOf(UsageLimitError);
    expect(error.reason).toBe("insufficient_balance");
  });

  it("returns the usage result when allowed", async () => {
    vi.stubEnv("RX_SUBSCRIPTION_URL", "https://subs.test");
    vi.stubEnv("RX_SUBSCRIPTION_API_KEY", "secret");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ allowed: true, used: 1, limit: 50 })));
    await expect(recordUsage({ rxlabUserId: "u", item: "mcp_tool_call", idempotencyKey: "k" })).resolves.toMatchObject({ allowed: true, used: 1 });
  });
});
