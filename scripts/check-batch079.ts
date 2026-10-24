/** bun --conditions=react-server scripts/check-batch079.ts simulation|live */
import assert from "node:assert/strict";
import { services } from "../generated/registry";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";
import type { ToolDefinition } from "../lib/mcp/types";
import manifest from "../tests/fixtures/batch079/manifest.json";

const mode = process.argv[2];
assert.ok(mode === "simulation" || mode === "live");
const base = "http://127.0.0.1:4979/development";
let checks = 0;
let failures = 0;
setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
for (const c of manifest) {
  const service = services.find((s) => s.id === c.service)!;
  const original = service.tools.find((t) => t.name === c.tool)!;
  const tool: ToolDefinition = mode === "simulation" ? { ...original, spec: { ...original.spec, baseUrl: base } } : original;
  const years = c.file === "2031" ? ["1999", "2003", "2007", "2015"] : [undefined];
  try {
    for (const year of years) {
    for (const lang of Object.keys(c.names)) {
      const result = await executeTool(service, tool, { limit: 1, lang, ...(year ? { year } : {}) });
      const data = result.data as { results: Record<string, unknown>[]; returned: number };
      assert.equal(data.returned, 1); assert.equal(data.results.length, 1);
      assert.equal(typeof data.results[0].name, "string");
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
setCacheForTesting(null);
console.log(JSON.stringify({ mode, passedChecks: checks, failedAPIs: failures }));
if (failures) process.exitCode = 1;
