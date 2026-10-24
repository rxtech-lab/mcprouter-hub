/** bun --conditions=react-server scripts/check-batch073.ts [captures|simulation|live] */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { services } from "../generated/registry";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";

const mode = process.argv[2] ?? "captures";
assert.ok(["captures", "simulation", "live"].includes(mode));
const entries = [
  ["API-2190", "hkma_information_centre", "2190", ["en", "tc", "sc"]],
  ["API-2414", "hkstp_companies", "2414", ["en", "tc", "sc"]],
  ["API-2418", "hkstp_jobs", "2418", [undefined]],
  ["API-2420", "hkstp_lab_office_space", "2420", [undefined]],
  ["API-2430", "ipostal_kiosks", "2430", ["en", "tc"]],
] as const;
const directory = process.env.BATCH073_CAPTURES ?? "/private/tmp/batch073-evidence";
const originalFetch = globalThis.fetch;
let calls = 0;
let failed = 0;
setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
try {
  for (const [api, name, file, languages] of entries) {
    const service = services.find((s) => s.tools.some((t) => t.name === name))!;
    const originalTool = service.tools.find((t) => t.name === name)!;
    const tool = mode === "simulation" ? { ...originalTool, spec: { ...originalTool.spec, baseUrl: "http://127.0.0.1:4973/commerce" } } : originalTool;
    try {
      for (const lang of languages) {
        if (mode === "captures") {
          globalThis.fetch = async () => {
          const capture = ["2190", "2430"].includes(file) ? `${file}-features-body` : ["2414", "2418"].includes(file) ? `${file}-decoded.json` : `${file}-body`;
          return new Response(readFileSync(`${directory}/${capture}`));
          };
        }
        const input = { ...(lang ? { lang } : {}), limit: mode === "captures" ? 100 : 1 };
        const result = await executeTool(service, tool, input);
        const data = result.data as { results: Record<string, unknown>[]; returned: number; nextOffset: number | null };
        assert.ok(data.returned > 0); assert.ok(data.returned <= input.limit); assert.equal(data.results.length, data.returned);
        assert.ok(Buffer.byteLength(JSON.stringify(data.results)) <= 100100);
        if (name === "hkstp_lab_office_space") assert.match(String(data.results[0].value), /sq ft/);
        console.log(JSON.stringify({ mode, api, tool: name, lang: lang ?? "source", status: "PASS", returned: data.returned, source: result.meta.source })); calls++;
      }
      if (mode === "simulation") {
        for (const [failure, code] of [["http", "upstream_http"], ["json", "upstream_parse"], ["malformed", "upstream_parse"]]) {
          const failing = { ...tool, spec: { ...tool.spec, headers: { "x-fixture-failure": failure } } };
          await assert.rejects(executeTool(service, failing, {}), { code }); calls++;
        }
        const empty = { ...tool, spec: { ...tool.spec, headers: { "x-fixture-failure": "empty" } } };
        if (name === "hkstp_lab_office_space") await assert.rejects(executeTool(service, empty, {}), { code: "upstream_parse" });
        else assert.deepEqual(((await executeTool(service, empty, {})).data as { results: unknown[] }).results, []);
        calls++;
        await assert.rejects(executeTool(service, tool, { limit: 101 }));
      }
    } catch (error) {
      failed++; console.error(JSON.stringify({ mode, api, status: "FAIL", error: String(error) }));
      // No retry of a provider failure or uncertain result.
    }
  }
  console.log(JSON.stringify({ mode, passedCalls: calls, failedAPIs: failed }));
  if (failed) process.exitCode = 1;
} finally { globalThis.fetch = originalFetch; setCacheForTesting(null); }
