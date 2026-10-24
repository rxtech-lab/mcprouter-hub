import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import { services } from "@/generated/registry";
import { createServiceRoute } from "@/lib/mcp/handler";
import { INTERNAL_SCOPES_HEADER, INTERNAL_USER_HEADER } from "@/lib/api-keys";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { batch066, fixture066 } from "./batch066-cases";
const key = "batch066-internal-key-0123456789";
const service = services.find((s) => s.id === "censtatd-business-energy")!;
const route = createServiceRoute(() => [service]);
const fetchMock = vi.fn<typeof fetch>();
async function rpc(method: string, params: unknown) {
  const response = await route(new Request(`https://hub.example/api/mcp/s/${service.id}/streamable`, {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream",
      authorization: `Bearer ${key}`, [INTERNAL_USER_HEADER]: "batch066-user", [INTERNAL_SCOPES_HEADER]: service.id },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }));
  expect(response.status).toBe(200);
  const text = await response.text();
  return JSON.parse(text.startsWith("event:") ? text.split("\n").find((s) => s.startsWith("data:"))!.slice(5) : text);
}
beforeAll(async () => { await migrate(db, { migrationsFolder: "db/migrations" }); });
beforeEach(() => {
  vi.stubEnv("MCPROUTER_INTERNAL_KEY", key);
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
  setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); setCacheForTesting(null); });
it("lists all ten batch066 tools on the service route", async () => {
  const listed = await rpc("tools/list", {});
  expect(listed.result.tools.map((t: { name: string }) => t.name)).toEqual(batch066.map((c) => c.tool));
});
it.each(batch066)("calls $api over MCP and reports validation/provider errors", async (c) => {
  fetchMock.mockResolvedValueOnce(Response.json(fixture066(c.table)));
  const called = await rpc("tools/call", { name: c.tool, arguments: { limit: 1 } });
  expect(called.error).toBeUndefined(); expect(called.result.isError).toBeFalsy();
  expect(JSON.parse(called.result.content[0].text).data).toMatchObject({ table: c.table, returned: 1 });
  const invalid = await rpc("tools/call", { name: c.tool, arguments: { limit: 101 } });
  expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
  const failed = await rpc("tools/call", { name: c.tool, arguments: {} });
  expect(failed.result.isError).toBe(true); expect(failed.result.content[0].text).toContain("503");
  fetchMock.mockResolvedValueOnce(Response.json({ header: { status: { name: "Fail", code: 1 } } }));
  const provider = await rpc("tools/call", { name: c.tool, arguments: {} });
  expect(provider.result.isError).toBe(true); expect(provider.result.content[0].text).toContain("official table");
});
