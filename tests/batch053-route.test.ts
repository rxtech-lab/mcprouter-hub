import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "@/db";
import { createServiceRoute } from "@/lib/mcp/handler";
import { INTERNAL_USER_HEADER } from "@/lib/api-keys";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { service } from "@/generated/services/censtatd-business-surveys";
import { batch053, fixture053 } from "./batch053-cases";
const batch = batch053.map(([table, tool]) => ({ table, tool, input: {} }));

const key = "batch053-internal-test-key";
const fetchMock = vi.fn<typeof fetch>();
beforeAll(async () => { await migrate(db, { migrationsFolder: "db/migrations" }); });
beforeEach(() => {
  vi.stubEnv("MCPROUTER_INTERNAL_KEY", key);
  setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset();vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals();vi.unstubAllEnvs();setCacheForTesting(null); });
async function rpc(name: string, method: string, params: unknown) {
  expect(service.tools.some((t) => t.name === name)).toBe(true);
  const route = createServiceRoute(() => [service]);
  const response = await route(new Request(`https://hub.example/api/mcp/s/${service.id}/streamable`, {
    method: "POST", headers: { authorization: `Bearer ${key}`, [INTERNAL_USER_HEADER]: "batch053-user", "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }));
  expect(response.status).toBe(200);
  const text = await response.text();
  return JSON.parse(text.startsWith("event:") || text.startsWith("data:") ? text.split("\n").find((line) => line.startsWith("data:"))!.slice(5) : text);
}
it.each(batch)("discovers and calls $tool on its scoped MCP route", async (c) => {
  const listed = await rpc(c.tool, "tools/list", {});
  expect(listed.result.tools.map((t: { name: string }) => t.name)).toContain(c.tool);
  fetchMock.mockImplementation(async () => Response.json(fixture053(c.table)));
  const called = await rpc(c.tool, "tools/call", { name: c.tool, arguments: { ...c.input, limit: 3 } });
  expect(called.result.isError).toBeFalsy();
  expect(JSON.parse(called.result.content[0].text).data).toMatchObject({ returned: 3, results: expect.any(Array) });
  const invalid = await rpc(c.tool, "tools/call", { name: c.tool, arguments: { ...c.input, limit: 101 } });
  expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it.each(batch)("returns actionable upstream failures on the MCP route: $tool", async (c) => {
  fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
  const called = await rpc(c.tool, "tools/call", { name: c.tool, arguments: c.input });
  expect(called.result.isError).toBe(true);
  expect(called.result.content[0].text).toContain("503");
});
