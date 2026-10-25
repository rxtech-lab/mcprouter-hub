/** bun --conditions=react-server scripts/check-batch086.ts simulation|live */
import assert from "node:assert/strict";
import { services } from "../generated/registry";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";
import type { ToolDefinition } from "../lib/mcp/types";
import manifest from "../tests/fixtures/batch086/manifest.json";

const mode = process.argv[2];
assert.ok(mode === "simulation" || mode === "live");
const base = "http://127.0.0.1:4986/development";
let checks = 0;
let failures = 0;
setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
for (const c of manifest) {
  const service = services.find((s) => s.id === c.service)!;
  const original = service.tools.find((t) => t.name === c.tool)!;
  const tool: ToolDefinition = mode === "simulation" ? { ...original, spec: { ...original.spec, baseUrl: base } } : original;
  const years = [undefined];
  try {
    for (const year of years) {
    for (const lang of Object.keys(c.names)) {
      const result = await executeTool(service, tool, { limit: 1, lang, ...(year ? { year } : {}) });
      const data = result.data as { results: Record<string, unknown>[]; returned: number };
      assert.equal(data.returned, 1); assert.equal(data.results.length, 1);
      assert.ok(data.results[0].name === null || typeof data.results[0].name === "string");
      assert.equal(data.results[0].name, data.results[0][(c.names as Record<string, string>)[lang]]);
      assert.ok(Number.isSafeInteger(data.results[0][c.oid]));
      assert.ok(Buffer.byteLength(JSON.stringify(data.results)) < 100100);
      console.log(JSON.stringify({ mode, api: c.api, tool: c.tool, year, lang, status: "PASS", returned: data.returned, source: result.meta.source })); checks++;
    }
    }
    if (mode === "simulation") {
      const first = (await executeTool(service, tool, { limit: 1, geometry: false })).data as { nextOffset: number | null; results: unknown[] };
      assert.equal(first.results.length, 1);
      if (first.nextOffset !== null) {
        const second = (await executeTool(service, tool, { limit: 1, offset: first.nextOffset, geometry: false })).data as { results: Record<string, unknown>[] };
        assert.equal(second.results.length, 1); checks++;
      }
      for (const [failure, code] of [["http", "upstream_http"], ["json", "upstream_parse"], ["malformed", "upstream_parse"], ["arcgis", "upstream_http"], ["timeout", "upstream_timeout"]]) {
        const failing = { ...tool, spec: { ...tool.spec, headers: { "x-fixture-failure": failure }, ...(failure === "timeout" ? { timeoutMs: 50 } : {}) } };
        await assert.rejects(executeTool(service, failing, {}), { code }); checks++;
      }
      const empty: ToolDefinition = { ...tool, spec: { ...tool.spec, headers: { "x-fixture-failure": "empty" } } };
      assert.deepEqual(((await executeTool(service, empty, {})).data as { results: unknown[] }).results, []); checks++;
      await assert.rejects(executeTool(service, tool, { limit: 101 })); checks++;
      const unreachable = { ...tool, spec: { ...tool.spec, baseUrl: "http://127.0.0.1:1/development" } };
      await assert.rejects(executeTool(service, unreachable, {}), { code: "upstream_network" }); checks++;
    }
  } catch (error) { failures++; console.error(JSON.stringify({ mode, api: c.api, status: "FAIL", error: String(error) })); }
}
for (const [name, input] of [
  ["landsd_satref_nmea_snapshot", {}],
  ["landsd_satref_rinex_header", { year: 2026, day: 298 }],
] as const) {
  const service = services.find((s) => s.tools.some((t) => t.name === name))!;
  const original = service.tools.find((t) => t.name === name)!;
  const tool = mode === "simulation" ? { ...original, spec: { ...original.spec, baseUrl: base } } : original;
  try {
    const langs = [undefined];
    for (const lang of langs) {
      const result = await executeTool(service, tool, { ...input, ...(lang ? { lang } : {}) });
      const data = result.data as Record<string, unknown>;
      if (name.endsWith("snapshot")) assert.equal(data.returned, 1);

      else if (name.endsWith("header")) { assert.equal(data.station, "HKCL"); assert.ok(Array.isArray(data.header)); }

      console.log(JSON.stringify({ mode, name, lang, status: "PASS", source: data.source ?? result.meta.source })); checks++;
    }
    if (mode === "simulation") {
      for (const [failure, code] of [["http", "upstream_http"], ["json", "upstream_parse"], ["timeout", "upstream_timeout"]]) {
        const failing = { ...tool, spec: { ...tool.spec, headers: { "x-fixture-failure": failure }, ...(failure === "timeout" ? { timeoutMs: 50 } : {}) } };
        await assert.rejects(executeTool(service, failing, input), { code }); checks++;
      }
      const offline = { ...tool, spec: { ...tool.spec, baseUrl: "http://127.0.0.1:1/development" } };
      await assert.rejects(executeTool(service, offline, input), { code: "upstream_network" }); checks++;
    }
  } catch (error) { failures++; console.error(JSON.stringify({ mode, name, status: "FAIL", error: String(error) })); }
}
if (mode === "simulation") {
  const { migrate } = await import("drizzle-orm/libsql/migrator");
  const { db } = await import("../db");
  const { createServiceRoute } = await import("../lib/mcp/handler");
  const { INTERNAL_USER_HEADER } = await import("../lib/api-keys");
  await migrate(db, { migrationsFolder: "db/migrations" });
  const key = "batch086-simulation-internal-key-0123456789";
  process.env.MCPROUTER_INTERNAL_KEY = key;
  const original = services.find((s) => s.id === "landsd-satref")!;
  const service = { ...original, tools: original.tools.map((t) => ({ ...t, spec: { ...t.spec, baseUrl: base } })) };
  const route = createServiceRoute(() => [service]);
  let id = 0;
  const rpc = async (method: string, params: unknown) => {
    const response = await route(new Request("https://hub.example/api/mcp/s/landsd-satref/streamable", {
      method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${key}`, [INTERNAL_USER_HEADER]: "batch086-simulation" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    }));
    assert.equal(response.status, 200); const text = await response.text();
    return JSON.parse(text.startsWith("event:") ? text.split("\n").find((l) => l.startsWith("data:"))!.slice(5) : text);
  };
  try {
    const listed = await rpc("tools/list", {});
    assert.ok(listed.result.tools.some((t: { name: string }) => t.name === "landsd_satref_nmea_snapshot")); checks++;
    const called = await rpc("tools/call", { name: "landsd_satref_nmea_snapshot", arguments: {} });
    assert.notEqual(called.result.isError, true);
    assert.equal(JSON.parse(called.result.content[0].text).data.returned, 1); checks++;
    const invalid = await rpc("tools/call", { name: "landsd_satref_nmea_snapshot", arguments: { limit: 4 } });
    assert.ok(invalid.result?.isError || invalid.error); checks++;
  } catch (error) { failures++; console.error(JSON.stringify({ mode, route: "NMEA", error: String(error) })); }
}
setCacheForTesting(null);
console.log(JSON.stringify({ mode, passedChecks: checks, failedAPIs: failures }));
if (failures) process.exitCode = 1;
