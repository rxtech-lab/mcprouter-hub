import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import { services } from "@/generated/registry";
import { INTERNAL_USER_HEADER } from "@/lib/api-keys";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { createServiceRoute } from "@/lib/mcp/handler";
import { batch073, fixture073, request073 } from "./batch073-cases";

const key = "batch073-test-internal-key-0123456789";
const fetchMock = vi.fn<typeof fetch>();
beforeAll(async () => { await migrate(db, { migrationsFolder: "db/migrations" }); });
beforeEach(() => {
  vi.stubEnv("MCPROUTER_INTERNAL_KEY", key);
  setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); setCacheForTesting(null); });

it.each(batch073)("discovers, calls and reports invalid input/provider failures for $api on scoped MCP route", async (c) => {
  const service = services.find((s) => s.id === c.service)!;
  const route = createServiceRoute(() => [service]);
  let id = 0;
  async function rpc(method: string, params: unknown) {
    const request = new Request(`https://hub.example/api/mcp/s/${c.service}/streamable`, {
      method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${key}`, [INTERNAL_USER_HEADER]: `batch073-${c.api}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    });
    const response = await route(request);
    expect(response.status).toBe(200);
    const text = await response.text();
    return JSON.parse(text.startsWith("event:") ? text.split("\n").find((l) => l.startsWith("data:"))!.slice(5) : text);
  }
  const listed = await rpc("tools/list", {});
  expect(listed.result.tools.map((t: { name: string }) => t.name)).toContain(c.tool);
  fetchMock.mockImplementationOnce(async (url) => { expect(String(url)).toBe(request073(c)); return Response.json(fixture073(c.file)); });
  const called = await rpc("tools/call", { name: c.tool, arguments: {} });
  expect(called.result.isError).not.toBe(true);
  expect(JSON.parse(called.result.content[0].text).data.returned).toBeGreaterThan(0);
  const invalid = await rpc("tools/call", { name: c.tool, arguments: { limit: 101 } });
  expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
  const failed = await rpc("tools/call", { name: c.tool, arguments: {} });
  expect(failed.result.isError).toBe(true); expect(failed.result.content[0].text).toContain("503");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
