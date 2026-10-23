/** bun --conditions=react-server scripts/check-batch058.ts [captures|live|simulation] */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { service as definition } from "../generated/services/censtatd-manufacturing-construction";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";

const mode = process.argv[2] ?? "captures";
assert.ok(["captures", "live", "simulation"].includes(mode));
const directory = process.env.BATCH058_CAPTURES ?? "/private/tmp/batch058-evidence";
const baseUrl = process.env.BATCH058_SIM_URL ?? "http://127.0.0.1:4958/censtatd/api";
assert.match(baseUrl, /^http:\/\/(127\.0\.0\.1|localhost):\d+\/censtatd\/api$/);
const service = mode === "simulation" ? { ...definition, baseUrl } : definition;
const fetchOriginal = globalThis.fetch;
if (mode === "captures") {
  globalThis.fetch = async (request) => {
    const url = new URL(String(request));
    assert.equal(url.origin + url.pathname, "https://www.censtatd.gov.hk/api/get.php");
    return new Response(readFileSync(`${directory}/${url.searchParams.get("id")}-${url.searchParams.get("lang")}.json`, "utf8"));
  };
}
setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
let calls = 0;
let failures = 0;
try {
  for (const [index, tool] of service.tools.entries()) {
    const table = String(tool.spec.query?.id);
    try {
      for (const lang of ["en", "tc", "sc"]) {
        const data = (await executeTool(service, tool, { lang, limit: 1 })).data as {
          table: string; title: string; language: string; total: number; returned: number; results: Record<string, unknown>[];
        };
        assert.equal(data.table, table); assert.equal(data.language, lang);
        assert.ok(data.title.length > 0); assert.equal(data.returned, 1); assert.ok(data.total > 0);
        assert.equal(data.results.length, 1);
        console.log(JSON.stringify({ mode, api: `API-${String(667 + index).padStart(4, "0")}`, table, lang, status: "PASS", total: data.total, latest: data.results[0].period }));
        calls++;
      }
      if (mode === "simulation") {
        for (const [failure, code] of [["http", "upstream_http"], ["json", "upstream_parse"], ["provider", "upstream_parse"], ["malformed", "upstream_parse"]]) {
          const failedTool = { ...tool, spec: { ...tool.spec, headers: { "x-fixture-failure": failure } } };
          await assert.rejects(executeTool(service, failedTool, {}), { code }); calls++;
        }
        const emptyTool = { ...tool, spec: { ...tool.spec, headers: { "x-fixture-failure": "empty" } } };
        assert.deepEqual(((await executeTool(service, emptyTool, {})).data as { results: unknown[] }).results, []); calls++;
      }
      await assert.rejects(executeTool(service, tool, { limit: 101 }));
    } catch (error) {
      failures++;
      console.error(JSON.stringify({ mode, api: `API-${String(667 + index).padStart(4, "0")}`, table, status: "FAIL", error: String(error) }));
      // Do not retry this table after a genuine failure.
    }
  }
  console.log(JSON.stringify({ mode, passedCalls: calls, failedTables: failures }));
  if (failures) process.exitCode = 1;
} finally { setCacheForTesting(null); globalThis.fetch = fetchOriginal; }
