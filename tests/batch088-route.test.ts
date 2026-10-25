import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import { services } from "@/generated/registry";
import { INTERNAL_USER_HEADER } from "@/lib/api-keys";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { createServiceRoute } from "@/lib/mcp/handler";
import { batch088, fixture088, request088 } from "./batch088-cases";

const key = "batch088-test-internal-key-0123456789";
const fetchMock = vi.fn<typeof fetch>();
beforeAll(async () => { await migrate(db, { migrationsFolder: "db/migrations" }); });
beforeEach(() => {
  vi.stubEnv("MCPROUTER_INTERNAL_KEY", key);
  setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); setCacheForTesting(null); });

it.each(batch088)("discovers, calls and reports invalid input/provider failures for $api on scoped MCP route", async (c) => {
  const service = services.find((s) => s.id === c.service)!;
  const route = createServiceRoute(() => [service]);
  let id = 0;
  async function rpc(method: string, params: unknown) {
    const request = new Request(`https://hub.example/api/mcp/s/${c.service}/streamable`, {
      method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${key}`, [INTERNAL_USER_HEADER]: `batch088-${c.api}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    });
    const response = await route(request);
    expect(response.status).toBe(200);
    const text = await response.text();
    return JSON.parse(text.startsWith("event:") ? text.split("\n").find((l) => l.startsWith("data:"))!.slice(5) : text);
  }
  const listed = await rpc("tools/list", {});
  expect(listed.result.tools.map((t: { name: string }) => t.name)).toContain(c.tool);
  fetchMock.mockImplementationOnce(async (url) => { expect(String(url)).toBe(request088(c)); return Response.json(fixture088(c)); });
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

it("discovers and executes the raster adapter on the MCP route", async () => {
  const service = services.find((s) => s.id === "pland-development")!;
  const route = createServiceRoute(() => [service]);
  const { readFileSync } = await import("node:fs");
  let id = 0;
  const rpc = async (method: string, params: unknown) => {
    const response = await route(new Request("https://hub.example/api/mcp/s/pland-development/streamable", {
      method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${key}`, [INTERNAL_USER_HEADER]: "batch088-raster" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    }));
    expect(response.status).toBe(200);
    const text = await response.text();
    return JSON.parse(text.startsWith("event:") ? text.split("\n").find((l) => l.startsWith("data:"))!.slice(5) : text);
  };
  expect((await rpc("tools/list", {})).result.tools.map((t: { name: string }) => t.name)).toContain("pland_land_use_cell");
  fetchMock.mockResolvedValueOnce(new Response(readFileSync(new URL("./fixtures/batch088/raster-2025.json", import.meta.url))));
  const args = { longitude: 114.17, latitude: 22.3 };
  const called = await rpc("tools/call", { name: "pland_land_use_cell", arguments: args });
  expect(called.result.isError).not.toBe(true);
  expect(JSON.parse(called.result.content[0].text).data.results[0].code).toBe(32);
  const invalid = await rpc("tools/call", { name: "pland_land_use_cell", arguments: { ...args, year: 2026 } });
  expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true);
  fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
  const failed = await rpc("tools/call", { name: "pland_land_use_cell", arguments: args });
  expect(failed.result.isError).toBe(true); expect(failed.result.content[0].text).toContain("503");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
