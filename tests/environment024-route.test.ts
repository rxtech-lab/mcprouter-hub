import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { services } from "@/generated/registry";
import { INTERNAL_CHANNEL_HEADER, INTERNAL_SCOPES_HEADER, INTERNAL_TOOLS_HEADER, INTERNAL_USER_HEADER } from "@/lib/api-keys";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { createServiceRoute } from "@/lib/mcp/handler";
import { cases024, definition024, profileCase024 } from "./environment024-cases";

const INTERNAL_KEY = "test-internal-key-0123456789";
const allServices = createServiceRoute(() => services);
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

describe("Environment Health 024 MCP routes", () => {
  it.each(cases024)("discovers and calls $tool $lang through its scoped route", async (c) => {
    const { service } = definition024(c.tool);
    const route = createServiceRoute(() => [service]);
    const options = { path: `/api/mcp/s/${service.id}/streamable`, scopes: service.id };
    const listed = await rpc(route, "tools/list", {}, options);
    expect(listed.result!.tools!.map((t) => t.name)).toContain(c.tool);
    fetchMock.mockResolvedValue(Response.json(c.reply));
    const result = await rpc(route, "tools/call", { name: c.tool, arguments: c.input }, options);
    expect(result.result!.isError).toBeFalsy(); expect(JSON.parse(result.result!.content![0].text).data).toEqual(c.data);
    const invalid = await rpc(route, "tools/call", { name: c.tool, arguments: { ...c.input, limit: 101 } }, options);
    expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(cases024)("surfaces upstream failure as MCP error for $tool $lang", async (c) => {
    fetchMock.mockResolvedValueOnce(new Response("maintenance", { status: 503 }));
    const result = await callTool(c.tool, c.input); expect(result.isError).toBe(true); expect(result.content![0].text).toContain("503");
  });
  it("discovers and calls the wind download adapter through MCP", async () => {
    const { service } = definition024(profileCase024.tool); const route = createServiceRoute(() => [service]);
    const options = { scopes: service.id };
    expect((await rpc(route, "tools/list", {}, options)).result!.tools!.map((t) => t.name)).toContain(profileCase024.tool);
    fetchMock.mockImplementation(async (url) => url.endsWith(".txt") ? new Response(profileCase024.body) : Response.json(profileCase024.grid));
    const result = await rpc(route, "tools/call", { name: profileCase024.tool, arguments: profileCase024.input }, options);
    expect(result.result!.isError).toBeFalsy(); expect(JSON.parse(result.result!.content![0].text).data).toMatchObject({ grid: "g_00337", total: 24, returned: 3 });
  });
});
