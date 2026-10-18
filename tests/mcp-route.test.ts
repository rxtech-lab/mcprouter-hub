import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { toolCalls } from "@/db/schema";
import { services } from "@/generated/registry";
import { INTERNAL_USER_HEADER } from "@/lib/api-keys";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { createServiceRoute } from "@/lib/mcp/handler";

/**
 * Drives the MCP endpoint the way a client does: JSON-RPC over streamable
 * HTTP, authenticated with the internal agent key, with the upstream stubbed.
 */

const INTERNAL_KEY = "test-internal-key-0123456789";
const allServices = createServiceRoute(() => services);
// Looked up by tool, not id, so the test survives services being merged or renamed.
const busService = services.find((service) => service.tools.some((tool) => tool.name === "kmb_stop_eta"))!;
const busOnly = createServiceRoute(() => [busService]);
const unknownService = createServiceRoute(() => null);

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const realFetch = globalThis.fetch;
let nextId = 1;

type RpcResponse = { result?: Record<string, unknown> & { tools?: Array<Record<string, unknown>>; content?: Array<{ type: string; text: string }>; isError?: boolean }; error?: { code: number; message: string } };

function rpcRequest(method: string, params: unknown, options: { user?: string; token?: string | null; path?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json, text/event-stream" };
  const token = options.token === undefined ? INTERNAL_KEY : options.token;
  if (token) headers.authorization = `Bearer ${token}`;
  if (options.user !== "") headers[INTERNAL_USER_HEADER] = options.user ?? "user-1";
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

describe("MCP endpoint", () => {
  it("lists every generated tool with its input schema", async () => {
    const { result } = await rpc(allServices, "tools/list", {});
    const listed = result!.tools!;
    expect(listed.map((tool) => tool.name).sort()).toEqual(services.flatMap((service) => service.tools.map((tool) => tool.name)).sort());

    const kmbStopEta = listed.find((tool) => tool.name === "kmb_stop_eta")!;
    expect(kmbStopEta).toMatchObject({
      title: "KMB arrivals at a stop",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: { type: "object", required: ["stopId"], properties: { stopId: { type: "string" }, route: { type: "string" } } },
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
      expect(tools.map((tool) => tool.name)).toContain("kmb_stop_eta");
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
    const result = await callTool("kmb_stop_eta", { stopId: "ABC123", route: "1a" }, { user: "route-ok" });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content![0].text)).toEqual({
      data: [{ route: "1A", dir: "O", eta: "2026-10-18T10:05:00+08:00" }],
      meta: { source: "https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/ABC123", total: 1, returned: 1, truncated: false },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await loggedCalls("route-ok", 1)).toMatchObject([{ service: busService.id, tool: "kmb_stop_eta", status: "ok", errorCode: null, apiKeyId: null }]);
  });

  it("sends a POST tool's arguments as the JSON body", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ routeName: "K12", busStop: [] })));
    const result = await callTool("mtr_bus_schedule", { routeName: "k12", language: "zh" });

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
