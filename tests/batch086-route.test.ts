import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import { services } from "@/generated/registry";
import { INTERNAL_USER_HEADER } from "@/lib/api-keys";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { createServiceRoute } from "@/lib/mcp/handler";
import { batch086, fixture086, request086 } from "./batch086-cases";

const key = "batch086-test-internal-key-0123456789";
const fetchMock = vi.fn<typeof fetch>();
beforeAll(async () => { await migrate(db, { migrationsFolder: "db/migrations" }); });
beforeEach(() => {
  vi.stubEnv("MCPROUTER_INTERNAL_KEY", key);
  setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); setCacheForTesting(null); });

it.each(batch086)("discovers, calls and reports invalid input/provider failures for $api on scoped MCP route", async (c) => {
  const service = services.find((s) => s.id === c.service)!;
  const route = createServiceRoute(() => [service]);
  let id = 0;
  async function rpc(method: string, params: unknown) {
    const request = new Request(`https://hub.example/api/mcp/s/${c.service}/streamable`, {
      method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${key}`, [INTERNAL_USER_HEADER]: `batch086-${c.api}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    });
    const response = await route(request);
    expect(response.status).toBe(200);
    const text = await response.text();
    return JSON.parse(text.startsWith("event:") ? text.split("\n").find((l) => l.startsWith("data:"))!.slice(5) : text);
  }
  const listed = await rpc("tools/list", {});
  expect(listed.result.tools.map((t: { name: string }) => t.name)).toContain(c.tool);
  fetchMock.mockImplementationOnce(async (url) => { expect(String(url)).toBe(request086(c)); return Response.json(fixture086(c)); });
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

it.each([
  { service: "landsd-satref", tool: "landsd_satref_rinex_header", input: { year: 2026, day: 298 }, invalid: { year: 2026, day: 367 }, fixture: "rinex.gz", binary: true },
])("discovers and executes file adapters through MCP: $tool", async (c) => {
  const { readFileSync } = await import("node:fs");
  const service = services.find((s) => s.id === c.service)!;
  const route = createServiceRoute(() => [service]); let id = 0;
  const rpc = async (method: string, params: unknown) => {
    const response = await route(new Request(`https://hub.example/api/mcp/s/${c.service}/streamable`, {
      method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${key}`, [INTERNAL_USER_HEADER]: `batch086-${c.tool}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    }));
    expect(response.status).toBe(200); const text = await response.text();
    return JSON.parse(text.startsWith("event:") ? text.split("\n").find((l) => l.startsWith("data:"))!.slice(5) : text);
  };
  const tools = (await rpc("tools/list", {})).result.tools;
  expect(tools.map((t: { name: string }) => t.name)).toContain(c.tool);
  if (c.service === "landsd-satref") {
    for (const name of ["landsd_satref_nmea_snapshot"]) {
      expect(tools.map((t: { name: string }) => t.name)).toContain(name);
      const invalid = await rpc("tools/call", { name, arguments: { station: "unknown" } });
      expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true);
    }
  }
  const fixture = readFileSync(new URL(`./fixtures/batch086/${c.fixture}`, import.meta.url));
  fetchMock.mockResolvedValueOnce(new Response(fixture));
  const called = await rpc("tools/call", { name: c.tool, arguments: c.input });
  expect(called.result.isError).not.toBe(true);
  const data = JSON.parse(called.result.content[0].text).data;
  expect(data.station).toBe("HKCL");
  const invalid = await rpc("tools/call", { name: c.tool, arguments: c.invalid });
  expect(invalid.result?.isError === true || invalid.error !== undefined).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
  const failed = await rpc("tools/call", { name: c.tool, arguments: c.input });
  expect(failed.result.isError).toBe(true); expect(failed.result.content[0].text).toContain("503");
});
