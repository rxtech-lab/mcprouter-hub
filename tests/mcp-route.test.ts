import { cases025, definition025 } from "./health025-cases";
import { spatialCases023, fileCases023, definition023 } from "./environment023-cases";
import { cases022, definition022 } from "./environment022-cases";
import { definition021, environmentCases } from "./environment021-cases";
import { governmentCases } from "./finance034-cases";
import { batch035, definition035, fixture035 } from "./finance035-cases";
import { marketsCases } from "./finance033-cases";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { apiKeys, mcpSettings, toolCalls } from "@/db/schema";
import { services } from "@/generated/registry";
import { displayPrefix, generateApiKey, hashApiKey, INTERNAL_CHANNEL_HEADER, INTERNAL_SCOPES_HEADER, INTERNAL_TOOLS_HEADER, INTERNAL_USER_HEADER } from "@/lib/api-keys";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { createServiceRoute, verifyMcpToken } from "@/lib/mcp/handler";
import { NO_SERVICES } from "@/lib/service-selection";
import { transportCases } from "./transport003-cases";
import { financeCases } from "./finance028-cases";
import { expenditureCases } from "./finance029-cases";
import { accountsCases } from "./finance030-cases";
import { investmentCases } from "./finance032-cases";
import { externalCases } from "./finance031-cases";

/**
 * Drives the MCP endpoint the way a client does: JSON-RPC over streamable
 * HTTP, authenticated with the internal agent key, with the upstream stubbed.
 */

const INTERNAL_KEY = "test-internal-key-0123456789";
const allServices = createServiceRoute(() => services);
// Looked up by tool, not id, so the test survives services being merged or renamed.
const busService = services.find((service) => service.tools.some((tool) => tool.name === "bus"))!;
const busOnly = createServiceRoute(() => [busService]);
const unknownService = createServiceRoute(() => null);

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const realFetch = globalThis.fetch;
let nextId = 1;

type RpcResponse = { result?: Record<string, unknown> & { tools?: Array<Record<string, unknown>>; content?: Array<{ type: string; text: string }>; isError?: boolean }; error?: { code: number; message: string } };

function rpcRequest(method: string, params: unknown, options: { user?: string; token?: string | null; path?: string; channel?: string; scopes?: string; tools?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json, text/event-stream" };
  const token = options.token === undefined ? INTERNAL_KEY : options.token;
  if (token) headers.authorization = `Bearer ${token}`;
  if (options.user !== "") headers[INTERNAL_USER_HEADER] = options.user ?? "user-1";
  if (options.channel) headers[INTERNAL_CHANNEL_HEADER] = options.channel;
  if (options.scopes) headers[INTERNAL_SCOPES_HEADER] = options.scopes;
  if (options.tools) headers[INTERNAL_TOOLS_HEADER] = options.tools;
  return new Request(`https://hub.example${options.path ?? "/api/mcp/streamable"}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
}

/** Responses come back as JSON or as a single SSE `message` event. */
async function readRpc(response: Response): Promise<RpcResponse> {
  const text = await response.text();
  if (!(response.headers.get("content-type") ?? "").includes("text/event-stream")) return JSON.parse(text);
  const data = text.split("\n").find((line) => line.startsWith("data:"));
  if (!data) throw new Error(`No data in SSE response: ${text}`);
  return JSON.parse(data.slice(5));
}

async function rpc(route: (request: Request) => Promise<Response>, method: string, params: unknown, options?: Parameters<typeof rpcRequest>[2]) {
  const response = await route(rpcRequest(method, params, options));
  expect(response.status).toBe(200);
  return readRpc(response);
}

async function callTool(name: string, args: Record<string, unknown>, options?: Parameters<typeof rpcRequest>[2]) {
  const { result, error } = await rpc(allServices, "tools/call", { name, arguments: args }, options);
  expect(error).toBeUndefined();
  return result!;
}

/** Tool calls are logged in the background, so wait for the row to land. */
async function loggedCalls(userId: string, count: number) {
  await vi.waitFor(async () => expect(await db.select().from(toolCalls).where(eq(toolCalls.userId, userId))).toHaveLength(count));
  return db.select().from(toolCalls).where(eq(toolCalls.userId, userId));
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
});

beforeEach(() => {
  vi.stubEnv("MCPROUTER_INTERNAL_KEY", INTERNAL_KEY);
  const store = new Map<string, unknown>();
  setCacheForTesting({
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: unknown) => void store.set(key, value),
    delete: async () => {},
    expireTag: async () => {},
  });
  fetchMock.mockReset();
  // Only upstream APIs are stubbed; anything else would be a real request.
  vi.stubGlobal("fetch", (url: string | URL | Request, init?: RequestInit) => fetchMock(String(url instanceof Request ? url.url : url), init));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  setCacheForTesting(null);
  globalThis.fetch = realFetch;
});

describe("Finance batch 028 MCP routes", () => {
  it.each(financeCases)("discovers and calls $tool on the scoped route", async ({ tool, input, request, reply, data }) => {
    const service = services.find((candidate) => candidate.id === "censtatd-gdp")!;
    const route = createServiceRoute(() => [service]);
    const options = { path: "/api/mcp/s/censtatd-gdp/streamable", scopes: service.id };
    const listed = await rpc(route, "tools/list", {}, options);
    expect(listed.result!.tools!.map((entry) => entry.name)).toEqual(service.tools.map((entry) => entry.name));
    fetchMock.mockImplementation(async (url) => {
      expect(url).toBe(request.url);
      return Response.json(reply);
    });
    const called = await rpc(route, "tools/call", { name: tool, arguments: input }, options);
    expect(called.result!.isError).toBeFalsy();
    expect(JSON.parse(called.result!.content![0].text).data).toEqual(data);
    const invalid = await rpc(route, "tools/call", { name: tool, arguments: { limit: 101 } }, options);
    expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns actionable tool errors for GDP upstream failures", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
    const result = await callTool("gdp_and_per_capita", {});
    expect(result.isError).toBe(true);
    expect(result.content![0].text).toContain("503");
    fetchMock.mockResolvedValueOnce(Response.json({ header: { status: { name: "Fail", code: 1 } } }));
    const failed = await callTool("gdp_and_per_capita", {});
    expect(failed.isError).toBe(true);
    expect(failed.content![0].text).toContain("official web table");
  });
});

describe("Finance batch 029 MCP routes", () => {
  it.each(expenditureCases)("discovers and calls $tool on the scoped route", async ({ tool, input, request, reply, data }) => {
    const service = services.find((candidate) => candidate.id === "censtatd-gdp-expenditure")!;
    const route = createServiceRoute(() => [service]);
    const options = { path: "/api/mcp/s/censtatd-gdp-expenditure/streamable", scopes: service.id };
    const listed = await rpc(route, "tools/list", {}, options);
    expect(listed.result!.tools!.map((entry) => entry.name)).toEqual(service.tools.map((entry) => entry.name));
    fetchMock.mockImplementation(async (url) => {
      expect(url).toBe(request.url);
      return Response.json(reply);
    });
    const called = await rpc(route, "tools/call", { name: tool, arguments: input }, options);
    expect(called.result!.isError).toBeFalsy();
    expect(JSON.parse(called.result!.content![0].text).data).toEqual(data);
    const invalid = await rpc(route, "tools/call", { name: tool, arguments: { limit: 101 } }, options);
    expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns actionable tool errors for GDP upstream failures", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
    const result = await callTool("gce_components_current", {});
    expect(result.isError).toBe(true);
    expect(result.content![0].text).toContain("503");
    fetchMock.mockResolvedValueOnce(Response.json({ header: { status: { name: "Fail", code: 1 } } }));
    const failed = await callTool("gce_components_current", {});
    expect(failed.isError).toBe(true);
    expect(failed.content![0].text).toContain("official web table");
  });
});

describe("Finance batch 030 MCP routes", () => {
  it.each(accountsCases)("discovers and calls $tool on the scoped route", async ({ tool, input, request, reply, data }) => {
    const service = services.find((candidate) => candidate.id === "censtatd-national-accounts")!;
    const route = createServiceRoute(() => [service]);
    const options = { path: "/api/mcp/s/censtatd-national-accounts/streamable", scopes: service.id };
    const listed = await rpc(route, "tools/list", {}, options);
    expect(listed.result!.tools!.map((entry) => entry.name)).toEqual(service.tools.map((entry) => entry.name));
    fetchMock.mockImplementation(async (url) => {
      expect(url).toBe(request.url);
      return Response.json(reply);
    });
    const called = await rpc(route, "tools/call", { name: tool, arguments: input }, options);
    expect(called.result!.isError).toBeFalsy();
    expect(JSON.parse(called.result!.content![0].text).data).toEqual(data);
    const invalid = await rpc(route, "tools/call", { name: tool, arguments: { limit: 101 } }, options);
    expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns actionable tool errors for GDP upstream failures", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
    const result = await callTool("production_account", {});
    expect(result.isError).toBe(true);
    expect(result.content![0].text).toContain("503");
    fetchMock.mockResolvedValueOnce(Response.json({ header: { status: { name: "Fail", code: 1 } } }));
    const failed = await callTool("production_account", {});
    expect(failed.isError).toBe(true);
    expect(failed.content![0].text).toContain("official web table");
  });
});

describe("Finance batch 031 MCP routes", () => {
  it.each(externalCases)("discovers and calls $tool on the scoped route", async ({ tool, input, request, reply, data }) => {
    const service = services.find((candidate) => candidate.id === "censtatd-external-accounts")!;
    const route = createServiceRoute(() => [service]);
    const options = { path: "/api/mcp/s/censtatd-external-accounts/streamable", scopes: service.id };
    const listed = await rpc(route, "tools/list", {}, options);
    expect(listed.result!.tools!.map((entry) => entry.name)).toEqual(service.tools.map((entry) => entry.name));
    fetchMock.mockImplementation(async (url) => {
      expect(url).toBe(request.url);
      return Response.json(reply);
    });
    const called = await rpc(route, "tools/call", { name: tool, arguments: input }, options);
    expect(called.result!.isError).toBeFalsy();
    expect(JSON.parse(called.result!.content![0].text).data).toEqual(data);
    const invalid = await rpc(route, "tools/call", { name: tool, arguments: { limit: 101 } }, options);
    expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns actionable tool errors for GDP upstream failures", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
    const result = await callTool("bop_current_capital_account", {});
    expect(result.isError).toBe(true);
    expect(result.content![0].text).toContain("503");
    fetchMock.mockResolvedValueOnce(Response.json({ header: { status: { name: "Fail", code: 1 } } }));
    const failed = await callTool("bop_current_capital_account", {});
    expect(failed.isError).toBe(true);
    expect(failed.content![0].text).toContain("official web table");
  });
});

describe("Finance batch 032 MCP routes", () => {
  it.each(investmentCases)("discovers and calls $tool on the scoped route", async ({ tool, input, request, reply, data }) => {
    const service = services.find((candidate) => candidate.id === "censtatd-investment")!;
    const route = createServiceRoute(() => [service]);
    const options = { path: "/api/mcp/s/censtatd-investment/streamable", scopes: service.id };
    const listed = await rpc(route, "tools/list", {}, options);
    expect(listed.result!.tools!.map((entry) => entry.name)).toEqual(service.tools.map((entry) => entry.name));
    fetchMock.mockImplementation(async (url) => {
      expect(url).toBe(request.url);
      return Response.json(reply);
    });
    const called = await rpc(route, "tools/call", { name: tool, arguments: input }, options);
    expect(called.result!.isError).toBeFalsy();
    expect(JSON.parse(called.result!.content![0].text).data).toEqual(data);
    const invalid = await rpc(route, "tools/call", { name: tool, arguments: { limit: 101 } }, options);
    expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns actionable tool errors for investment upstream failures", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
    const result = await callTool("external_debt", {});
    expect(result.isError).toBe(true);
    expect(result.content![0].text).toContain("503");
    fetchMock.mockResolvedValueOnce(Response.json({ header: { status: { name: "Fail", code: 1 } } }));
    const failed = await callTool("external_debt", {});
    expect(failed.isError).toBe(true);
    expect(failed.content![0].text).toContain("official web table");
  });
});

describe("Finance batch 033 MCP routes", () => {
  it.each(marketsCases)("discovers and calls $tool on the scoped route", async ({ tool, input, request, reply, data }) => {
    const service = services.find((candidate) => candidate.id === "censtatd-financial-markets")!;
    const route = createServiceRoute(() => [service]);
    const options = { path: "/api/mcp/s/censtatd-financial-markets/streamable", scopes: service.id };
    const listed = await rpc(route, "tools/list", {}, options);
    expect(listed.result!.tools!.map((entry) => entry.name)).toEqual(service.tools.map((entry) => entry.name));
    fetchMock.mockImplementation(async (url) => {
      expect(url).toBe(request.url);
      return Response.json(reply);
    });
    const called = await rpc(route, "tools/call", { name: tool, arguments: input }, options);
    expect(called.result!.isError).toBeFalsy();
    expect(JSON.parse(called.result!.content![0].text).data).toEqual(data);
    const invalid = await rpc(route, "tools/call", { name: tool, arguments: { limit: 101 } }, options);
    expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns actionable tool errors for financial markets upstream failures", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
    const result = await callTool("currency_in_circulation", {});
    expect(result.isError).toBe(true);
    expect(result.content![0].text).toContain("503");
    fetchMock.mockResolvedValueOnce(Response.json({ header: { status: { name: "Fail", code: 1 } } }));
    const failed = await callTool("currency_in_circulation", {});
    expect(failed.isError).toBe(true);
    expect(failed.content![0].text).toContain("official web table");
  });
});

describe("Finance batch 035 MCP routes", () => {
  it.each(batch035)("discovers and calls $tool on its scoped route", async (c) => {
    const { service } = definition035(c.tool);
    const route = createServiceRoute(() => [service]);
    const options = { path: `/api/mcp/s/${service.id}/streamable`, scopes: service.id };
    const listed = await rpc(route, "tools/list", {}, options);
    expect(listed.result!.tools!.map((tool) => tool.name)).toContain(c.tool);
    fetchMock.mockImplementation(async () => new Response(fixture035(c.fixture)));
    const called = await rpc(route, "tools/call", { name: c.tool, arguments: c.input }, options);
    expect(called.result!.isError).toBeFalsy();
    expect(JSON.parse(called.result!.content![0].text).data).toMatchObject({ returned: expect.any(Number), results: expect.any(Array) });
    const invalid = await rpc(route, "tools/call", { name: c.tool, arguments: { ...c.input, limit: 101 } }, options);
    expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(batch035)("returns upstream HTTP failures as MCP tool errors: $tool", async (c) => {
    fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
    const result = await callTool(c.tool, c.input);
    expect(result.isError).toBe(true);
    expect(result.content![0].text).toContain("503");
  });
});

describe("Finance batch 034 MCP routes", () => {
  it.each(governmentCases)("discovers and calls $tool on the scoped route", async ({ tool, input, request, reply, data }) => {
    const service = services.find((candidate) => candidate.id === "censtatd-government-markets")!;
    const route = createServiceRoute(() => [service]);
    const options = { path: "/api/mcp/s/censtatd-government-markets/streamable", scopes: service.id };
    const listed = await rpc(route, "tools/list", {}, options);
    expect(listed.result!.tools!.map((entry) => entry.name)).toEqual(service.tools.map((entry) => entry.name));
    fetchMock.mockImplementation(async (url) => {
      expect(url).toBe(request.url);
      return Response.json(reply);
    });
    const called = await rpc(route, "tools/call", { name: tool, arguments: input }, options);
    expect(called.result!.isError).toBeFalsy();
    expect(JSON.parse(called.result!.content![0].text).data).toEqual(data);
    const invalid = await rpc(route, "tools/call", { name: tool, arguments: { limit: 101 } }, options);
    expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns actionable tool errors for government and markets upstream failures", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
    const result = await callTool("interbank_market", {});
    expect(result.isError).toBe(true);
    expect(result.content![0].text).toContain("503");
    fetchMock.mockResolvedValueOnce(Response.json({ header: { status: { name: "Fail", code: 1 } } }));
    const failed = await callTool("interbank_market", {});
    expect(failed.isError).toBe(true);
    expect(failed.content![0].text).toContain("official web table");
  });
});

describe("transport batch 003 MCP routes", () => {
  it.each(transportCases)("discovers and calls $tool through its scoped service route", async (testCase) => {
    const service = services.find((service) => service.tools.some((tool) => tool.name === testCase.tool || tool.operations?.some((operation) => operation.name === testCase.tool)))!;
    const publicName = service.combinedTool ?? testCase.tool;
    const input = service.combinedTool ? { ...testCase.input, action: testCase.tool } : testCase.input;
    const route = createServiceRoute(() => [service]);
    const options = { path: `/api/mcp/s/${service.id}/streamable`, scopes: service.id };
    const listed = await rpc(route, "tools/list", {}, options);
    expect(listed.result!.tools!.map((tool) => tool.name)).toContain(publicName);
    fetchMock.mockImplementation(async (url) => {
      expect(url).toBe(testCase.request.url);
      return new Response(typeof testCase.reply === "string" ? testCase.reply : JSON.stringify(testCase.reply));
    });
    const { result } = await rpc(route, "tools/call", { name: publicName, arguments: input }, options);
    expect(result!.isError).toBeFalsy();
    expect(JSON.parse(result!.content![0].text).data).toEqual(testCase.data);
    const invalid = await rpc(route, "tools/call", { name: publicName, arguments: { ...input, ...(testCase.tool === "border_vehicle_throughput" ? { year: 2015 } : { limit: -1 }) } }, options);
    expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a tool error for a blocked upstream", async () => {
    fetchMock.mockResolvedValue(new Response("Unavailable", { status: 503 }));
    const result = await callTool("gpa_public_carparks", {});
    expect(result.isError).toBe(true);
    expect(result.content![0].text).toContain("503");
  });
});

describe("MCP endpoint", () => {
  it("lists every generated tool with its input schema", async () => {
    const { result } = await rpc(allServices, "tools/list", {});
    const listed = result!.tools!;
    expect(listed.map((tool) => tool.name).sort()).toEqual(services.flatMap((service) => service.tools.map((tool) => tool.name)).sort());

    const kmbStopEta = listed.find((tool) => tool.name === "bus")!;
    expect(kmbStopEta).toMatchObject({
      title: "Buses, Minibuses & Trams",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: { type: "object", required: ["action"], properties: { stopId: { type: "string" }, route: { type: "string" } } },
    });
  });

  it("serves the agent in-process, without a network round trip that a domain redirect could strip auth from", async () => {
    const { createMCPClient } = await import("@ai-sdk/mcp");
    const { selfMcpFetch } = await import("@/lib/agent/self-fetch");
    const client = await createMCPClient({
      transport: { type: "http", url: "https://apex.example/api/mcp/streamable", headers: { Authorization: `Bearer ${INTERNAL_KEY}`, [INTERNAL_USER_HEADER]: "user-1" }, fetch: selfMcpFetch },
    });
    try {
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toContain("bus");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      await client.close();
    }
  });

  it("lists only one service's tools on a per-service endpoint", async () => {
    const { result } = await rpc(busOnly, "tools/list", {}, { path: `/api/mcp/s/${busService.id}/streamable` });
    const names = result!.tools!.map((tool) => tool.name);
    expect(names.sort()).toEqual(busService.tools.map((tool) => tool.name).sort());
  });

  it("calls a tool, sends the HTTP request upstream and returns the shaped JSON", async () => {
    fetchMock.mockImplementation(async (url) => {
      expect(url).toBe("https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/ABC123");
      return new Response(JSON.stringify({ data: [{ co: "KMB", route: "1A", dir: "O", eta: "2026-10-18T10:05:00+08:00" }, { co: "KMB", route: "2", dir: "O", eta: null }] }));
    });
    const result = await callTool("bus", { action: "kmb_stop_eta", stopId: "ABC123", route: "1a" }, { user: "route-ok" });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content![0].text)).toEqual({
      data: [{ route: "1A", dir: "O", eta: "2026-10-18T10:05:00+08:00" }],
      meta: { source: "https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/ABC123", total: 1, returned: 1, truncated: false },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await loggedCalls("route-ok", 1)).toMatchObject([{ service: busService.id, tool: "bus", status: "ok", errorCode: null, apiKeyId: null, channel: "web" }]);
  });

  it("logs the agent channel the internal caller names, and the web chat for anything else", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ data: [] })));
    await callTool("bus", { action: "kmb_stop_eta", stopId: "ABC123" }, { user: "route-telegram", channel: "telegram" });
    await callTool("bus", { action: "kmb_stop_eta", stopId: "ABC123" }, { user: "route-spoofed", channel: "oauth" });
    expect(await loggedCalls("route-telegram", 1)).toMatchObject([{ channel: "telegram", oauthClientId: null }]);
    expect(await loggedCalls("route-spoofed", 1)).toMatchObject([{ channel: "web" }]);
  });

  it("sends a POST tool's arguments as the JSON body", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ routeName: "K12", busStop: [] })));
    const result = await callTool("bus", { action: "mtr_bus_schedule", routeName: "k12", language: "zh" });

    expect(JSON.parse(result.content![0].text).data).toEqual({ routeName: "K12", busStop: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://rt.data.gov.hk/v1/transport/mtr/bus/getSchedule");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ routeName: "K12", language: "zh" });
  });

  it("returns an upstream failure as a tool error and logs its code", async () => {
    fetchMock.mockImplementation(async () => new Response("down for maintenance", { status: 503 }));
    const result = await callTool("hko_current_weather", {}, { user: "route-upstream-down" });

    expect(result.isError).toBe(true);
    expect(result.content![0].text).toMatch(/upstream API answered 503: down for maintenance/);
    expect(await loggedCalls("route-upstream-down", 1)).toMatchObject([{ status: "error", errorCode: "upstream_http" }]);
  });

  it("rejects invalid arguments without calling upstream", async () => {
    const { result, error } = await rpc(allServices, "tools/call", { name: "hko_lunar_date", arguments: { date: "17/02/2026" } }, { user: "route-invalid" });

    // Either the SDK rejects the arguments up front or the runtime reports them; both must name the field and skip upstream.
    const message = error?.message ?? result?.content?.[0]?.text ?? "";
    expect(error ? true : result?.isError).toBe(true);
    expect(message).toMatch(/date/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not expose a tool outside the endpoint's services", async () => {
    const { result, error } = await rpc(busOnly, "tools/call", { name: "hko_current_weather", arguments: {} }, { path: `/api/mcp/s/${busService.id}/streamable` });
    expect(error ?? result?.isError).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("limits a bot link to the services the internal caller names", async () => {
    const { result } = await rpc(allServices, "tools/list", {}, { channel: "telegram", scopes: busService.id });
    expect(result!.tools!.map((tool) => tool.name).sort()).toEqual(busService.tools.map((tool) => tool.name).sort());
    const call = await rpc(allServices, "tools/call", { name: "hko_current_weather", arguments: {} }, { channel: "telegram", scopes: busService.id });
    expect(call.error ?? call.result?.isError).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists no tools for a bot link allowed no services", async () => {
    const { result, error } = await rpc(allServices, "tools/list", {}, { channel: "telegram", scopes: NO_SERVICES });
    expect(error).toBeUndefined();
    expect(result!.tools).toEqual([]);
  });

  it("only trusts the already-metered marker with the internal agent key", async () => {
    const internal = rpcRequest("tools/list", {}, { channel: "telegram" });
    internal.headers.set("x-mcprouter-chat-metered", "1");
    expect((await verifyMcpToken(internal, INTERNAL_KEY))?.extra).toMatchObject({ chatMetered: true });
    const key = generateApiKey();
    await db.insert(apiKeys).values({ userId: "marker-user", name: "marker test", prefix: displayPrefix(key), hash: hashApiKey(key) });
    const external = rpcRequest("tools/list", {}, { token: key, channel: "telegram" });
    external.headers.set("x-mcprouter-chat-metered", "1");
    expect((await verifyMcpToken(external, key))?.extra).not.toHaveProperty("chatMetered");
  });

  it("requires a token", async () => {
    const response = await allServices(rpcRequest("tools/list", {}, { token: null }));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toMatch(/oauth-protected-resource\/api\/mcp\/streamable/);
  });

  it("rejects a wrong token and an internal key without a user", async () => {
    expect((await allServices(rpcRequest("tools/list", {}, { token: "mcpr_not-a-real-key" }))).status).toBe(401);
    expect((await allServices(rpcRequest("tools/list", {}, { user: "" }))).status).toBe(401);
  });

  it("answers 404 for an unknown service", async () => {
    const response = await unknownService(rpcRequest("tools/list", {}, { path: "/api/mcp/s/nope/streamable" }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "unknown_service" });
  });
});

describe("MCP endpoint in search mode", () => {
  // The combined endpoint's default; the per-service endpoint has no default and always lists real tools.
  const searchRoute = createServiceRoute(() => services, { defaultToolMode: "search" });
  const call = async (name: string, args: Record<string, unknown>, options?: Parameters<typeof rpcRequest>[2]) => {
    const { result, error } = await rpc(searchRoute, "tools/call", { name, arguments: args }, options);
    expect(error).toBeUndefined();
    return result!;
  };

  it("lists only search_tools, read_tool and use_tool", async () => {
    const { result } = await rpc(searchRoute, "tools/list", {});
    expect(result!.tools!.map((tool) => tool.name)).toEqual(["search_tools", "read_tool", "use_tool"]);
  });

  it("lists every tool with ?tools=all", async () => {
    const { result } = await rpc(searchRoute, "tools/list", {}, { path: "/api/mcp/streamable?tools=all" });
    expect(result!.tools!.length).toBe(services.reduce((sum, service) => sum + service.tools.length, 0));
  });

  it("lets a bot link choose search mode on an endpoint that lists every tool", async () => {
    const { result } = await rpc(allServices, "tools/list", {}, { channel: "telegram", tools: "search" });
    expect(result!.tools!.map((tool) => tool.name)).toEqual(["search_tools", "read_tool", "use_tool"]);
  });

  it("ignores a tool mode it doesn't know", async () => {
    const { result } = await rpc(searchRoute, "tools/list", {}, { tools: "everything" });
    expect(result!.tools!.map((tool) => tool.name)).toEqual(["search_tools", "read_tool", "use_tool"]);
  });

  it("puts a key's own tool mode before ?tools= and the endpoint's default", async () => {
    const plaintext = (toolMode: "all" | "search" | null) => {
      const key = generateApiKey();
      return { key, row: { userId: "key-user", name: `mode ${toolMode}`, prefix: displayPrefix(key), hash: hashApiKey(key), toolMode } };
    };
    const everyTool = plaintext("all");
    const searchOnly = plaintext("search");
    const unset = plaintext(null);
    await db.insert(apiKeys).values([everyTool.row, searchOnly.row, unset.row]);
    const names = async (route: typeof searchRoute, key: string, path?: string) =>
      (await rpc(route, "tools/list", {}, { token: key, user: "", path })).result!.tools!.map((tool) => tool.name);

    expect(await names(searchRoute, everyTool.key)).toContain("bus");
    expect(await names(searchRoute, searchOnly.key, "/api/mcp/streamable?tools=all")).toEqual(["search_tools", "read_tool", "use_tool"]);
    expect(await names(busOnly, searchOnly.key, `/api/mcp/s/${busService.id}/streamable`)).toEqual(["search_tools", "read_tool", "use_tool"]);
    expect(await names(searchRoute, unset.key)).toEqual(["search_tools", "read_tool", "use_tool"]);
    expect(await names(busOnly, unset.key, `/api/mcp/s/${busService.id}/streamable`)).toContain("bus");
  });

  it("keeps the per-service endpoint on real tool names, even with ?tools=search", async () => {
    const { result } = await rpc(busOnly, "tools/list", {}, { path: `/api/mcp/s/${busService.id}/streamable?tools=search` });
    expect(result!.tools!.map((tool) => tool.name)).toContain("bus");
  });

  it("searches tools, capped at the requested limit", async () => {
    // The embedding model is unreachable here, so search falls back to keywords.
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("offline"));
    const result = await call("search_tools", { query: "kmb stop eta", limit: 3 });
    const { tools } = JSON.parse(result.content![0].text) as { tools: Array<{ name: string; service: string }> };
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.length).toBeLessThanOrEqual(3);
    expect(tools.map((tool) => tool.name)).toContain("bus");
  });

  it("reads a tool's schema and rejects unknown tools", async () => {
    const read = await call("read_tool", { name: "bus" });
    expect(JSON.parse(read.content![0].text)).toMatchObject({ name: "bus", service: busService.id, inputSchema: { type: "object", required: ["action"] } });
    const unknown = await call("read_tool", { name: "nope" });
    expect(unknown.isError).toBe(true);
  });

  it("runs a tool through use_tool and logs it under the tool's own name", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ data: [] })));
    const result = await call("use_tool", { name: "bus", arguments: { action: "kmb_stop_eta", stopId: "ABC123" } }, { user: "route-use-tool" });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content![0].text).meta.source).toBe("https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/ABC123");
    expect(await loggedCalls("route-use-tool", 1)).toMatchObject([{ service: busService.id, tool: "bus", status: "ok" }]);
  });

  it("validates use_tool arguments against the real tool's schema", async () => {
    const result = await call("use_tool", { name: "bus", arguments: { action: "kmb_stop_eta" } }, { user: "route-use-invalid" });
    expect(result.isError).toBe(true);
    expect(result.content![0].text).toMatch(/stopId/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("MCP endpoint with exposure settings", () => {
  const weather = services.find((service) => service.tools.some((tool) => tool.name === "hko_current_weather"))!;
  const searchRoute = createServiceRoute(() => services, { defaultToolMode: "search" });

  async function expose(userId: string, settings: { regions?: string[]; services?: string[]; hiddenTools?: string[] }) {
    await db.delete(mcpSettings).where(eq(mcpSettings.userId, userId));
    await db.insert(mcpSettings).values({ userId, ...settings });
  }

  it("lists only the services and tools the user exposes", async () => {
    await expose("exposure-1", { services: [busService.id, weather.id], hiddenTools: ["bus"] });
    const { result } = await rpc(allServices, "tools/list", {}, { user: "exposure-1" });
    const expected = [...busService.tools, ...weather.tools].map((tool) => tool.name).filter((name) => name !== "bus");
    expect(result!.tools!.map((tool) => tool.name).sort()).toEqual(expected.sort());
  });

  it("refuses a hidden tool, also through use_tool", async () => {
    await expose("exposure-2", { services: [weather.id] });
    const direct = await rpc(allServices, "tools/call", { name: "bus", arguments: { action: "kmb_stop_eta", stopId: "X" } }, { user: "exposure-2" });
    expect(direct.error ?? direct.result?.isError).toBeTruthy();
    const viaMeta = await rpc(searchRoute, "tools/call", { name: "use_tool", arguments: { name: "bus", arguments: { action: "kmb_stop_eta", stopId: "X" } } }, { user: "exposure-2" });
    expect(viaMeta.result!.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hides services outside the exposed regions", async () => {
    await expose("exposure-3", { regions: ["elsewhere"] });
    const { result, error } = await rpc(allServices, "tools/list", {}, { user: "exposure-3" });
    // With no tools the server has no tools capability, so the list is empty or not offered at all.
    expect(error ? [] : result!.tools).toEqual([]);
  });

  it("answers 403 on the endpoint of a hidden service", async () => {
    await expose("exposure-4", { services: [weather.id] });
    const response = await busOnly(rpcRequest("tools/list", {}, { user: "exposure-4", path: `/api/mcp/s/${busService.id}/streamable` }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "service_not_exposed" });
  });

  it("leaves guests of the free agent on the whole catalogue", async () => {
    const { result } = await rpc(allServices, "tools/list", {}, { user: "guest:exposure" });
    expect(result!.tools!.length).toBe(services.reduce((sum, service) => sum + service.tools.length, 0));
  });
});


describe("Environment batch 021 MCP routes", () => {
  it.each(environmentCases)("discovers and calls $tool $file on its dedicated route", async (c) => {
    const { service } = definition021(c.tool);
    const route = createServiceRoute(() => [service]);
    const options = { path: `/api/mcp/s/${service.id}/streamable`, scopes: service.id };
    const listed = await rpc(route, "tools/list", {}, options);
    expect(listed.result!.tools!.map((t) => t.name)).toContain(c.tool);
    fetchMock.mockImplementation(async (url) => {
      expect(url).toBe(c.request.url);
      return new Response(typeof c.reply === "string" ? c.reply : JSON.stringify(c.reply));
    });
    const called = await rpc(route, "tools/call", { name: c.tool, arguments: c.input }, options);
    expect(called.result!.isError).toBeFalsy();
    expect(JSON.parse(called.result!.content![0].text).data).toEqual(c.data);
    const invalid = await rpc(route, "tools/call", { name: c.tool, arguments: { ...c.input, limit: 101 } }, options);
    expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(environmentCases)("surfaces upstream failure as MCP error: $tool $file", async (c) => {
    fetchMock.mockResolvedValueOnce(new Response("maintenance", { status: 503 }));
    const result = await callTool(c.tool, c.input);
    expect(result.isError).toBe(true);
    expect(result.content![0].text).toContain("503");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});


describe("Environment batch 022 MCP routes", () => {
  it.each(cases022)("discovers and calls $tool $file on its dedicated route", async (c) => {
    const { service } = definition022(c.tool);
    const route = createServiceRoute(() => [service]);
    const options = { path: `/api/mcp/s/${service.id}/streamable`, scopes: service.id };
    const listed = await rpc(route, "tools/list", {}, options);
    expect(listed.result!.tools!.map((t) => t.name)).toContain(c.tool);
    fetchMock.mockImplementation(async (url) => {
      expect(url).toBe(c.request.url);
      return new Response(typeof c.reply === "string" ? c.reply : JSON.stringify(c.reply));
    });
    const called = await rpc(route, "tools/call", { name: c.tool, arguments: c.input }, options);
    expect(called.result!.isError).toBeFalsy();
    expect(JSON.parse(called.result!.content![0].text).data).toEqual(c.data);
    const invalid = await rpc(route, "tools/call", { name: c.tool, arguments: { ...c.input, limit: 101 } }, options);
    expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(cases022)("surfaces upstream failure as MCP error: $tool $file", async (c) => {
    fetchMock.mockResolvedValueOnce(new Response("maintenance", { status: 503 }));
    const result = await callTool(c.tool, c.input);
    expect(result.isError).toBe(true);
    expect(result.content![0].text).toContain("503");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("Environment batch 023 MCP routes", () => {
  it.each(spatialCases023)("discovers and calls $tool $file on its dedicated route", async (c) => {
    const { service } = definition023(c.tool);
    const route = createServiceRoute(() => [service]);
    const options = { path: `/api/mcp/s/${service.id}/streamable`, scopes: service.id };
    const listed = await rpc(route, "tools/list", {}, options);
    expect(listed.result!.tools!.map((t) => t.name)).toContain(c.tool);
    fetchMock.mockImplementation(async (url) => {
      expect(url).toBe(c.request.url);
      return new Response(typeof c.reply === "string" ? c.reply : JSON.stringify(c.reply));
    });
    const called = await rpc(route, "tools/call", { name: c.tool, arguments: c.input }, options);
    expect(called.result!.isError).toBeFalsy();
    expect(JSON.parse(called.result!.content![0].text).data).toEqual(c.data);
    const invalid = await rpc(route, "tools/call", { name: c.tool, arguments: { ...c.input, limit: 101 } }, options);
    expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(spatialCases023)("surfaces upstream failure as MCP error: $tool $file", async (c) => {
    fetchMock.mockResolvedValueOnce(new Response("maintenance", { status: 503 }));
    const result = await callTool(c.tool, c.input);
    expect(result.isError).toBe(true);
    expect(result.content![0].text).toContain("503");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});


describe("Environment 023 file adapters MCP routes", () => {
  it.each(fileCases023)("discovers and calls $tool $lang through MCP", async (c) => {
    const { service } = definition023(c.tool);
    const route = createServiceRoute(() => [service]);
    const listed = await rpc(route, "tools/list", {});
    expect(listed.result!.tools!.map((t) => t.name)).toContain(c.tool);
    fetchMock.mockImplementation(async (url) => { expect(url).toBe(c.request.url); return new Response(c.reply); });
    const result = await rpc(route, "tools/call", { name: c.tool, arguments: c.input });
    expect(result.result!.isError).toBeFalsy();
    expect(JSON.parse(result.result!.content![0].text).data).toMatchObject({ returned: 2, source: c.request.url });
    const invalid = await rpc(route, "tools/call", { name: c.tool, arguments: { ...c.input, lang: "fr" } });
    expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(fileCases023)("surfaces download failure: $tool $lang", async (c) => {
    fetchMock.mockResolvedValueOnce(new Response("maintenance", { status: 503 }));
    const result = await callTool(c.tool, c.input);
    expect(result.isError).toBe(true); expect(result.content![0].text).toContain("503");
  });
});

describe("Health 025 MCP routes", () => {
  it.each(cases025)("discovers and calls $tool in $input.lang", async (c) => {
    const { service } = definition025(c.tool);
    const route = createServiceRoute(() => [service]);
    const listed = await rpc(route, "tools/list", {});
    expect(listed.result!.tools!.map((t) => t.name)).toContain(c.tool);
    fetchMock.mockResolvedValueOnce(typeof c.reply === "string" ? new Response(c.reply) : Response.json(c.reply));
    const result = await rpc(route, "tools/call", { name: c.tool, arguments: c.input });
    expect(result.result!.isError).not.toBe(true);
    expect(JSON.parse(result.result!.content![0].text).data).toMatchObject({ returned: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(cases025.filter((c) => c.input.lang === "en"))("reports invalid inputs and upstream errors for $tool", async (c) => {
    const route = createServiceRoute(() => [definition025(c.tool).service]);
    const invalid = await rpc(route, "tools/call", { name: c.tool, arguments: { limit: 101 } });
    expect(Boolean(invalid.error) || invalid.result?.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(new Response("<html>Maintenance</html>", { status: 503 }));
    const failed = await rpc(route, "tools/call", { name: c.tool, arguments: c.input });
    expect(failed.result!.isError).toBe(true);
    expect(failed.result!.content![0].text).toContain("503");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

});
