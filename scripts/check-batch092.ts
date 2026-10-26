/** bun --conditions=react-server scripts/check-batch092.ts simulation|live */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { services } from "../generated/registry";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";
import type { ToolDefinition, ToolInput } from "../lib/mcp/types";
import manifest from "../tests/fixtures/batch092/manifest.json";

const mode = process.argv[2];
assert.ok(mode === "simulation" || mode === "live");
const base = "http://127.0.0.1:4992/census";
const evidence = process.env.BATCH092_EVIDENCE_DIR;
const nativeFetch = globalThis.fetch;
let capture = 0;
if (mode === "live" && evidence) {
  mkdirSync(evidence, { recursive: true });
  globalThis.fetch = (async (url, init) => {
    const response = await nativeFetch(url, init);
    const bytes = Buffer.from(await response.clone().arrayBuffer());
    const file = `live-${++capture}.json`;
    writeFileSync(`${evidence}/${file}`, bytes);
    writeFileSync(`${evidence}/${file}.meta`, JSON.stringify({ url: String(url), status: response.status, capturedAt: new Date().toISOString(), sha256: createHash("sha256").update(bytes).digest("hex") }, null, 2));
    return response;
  }) as typeof fetch;
}
let checks = 0;
let failures = 0;
setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
for (const c of manifest) {
  const service = services.find((s) => s.id === c.service)!;
  const original = service.tools.find((t) => t.name === c.tool)!;
  const tool: ToolDefinition = mode === "simulation" ? { ...original, spec: { ...original.spec, baseUrl: base } } : original;
  const run = async (input: ToolInput) => {
    const result = await executeTool(service, tool, input);
    const data = result.data as { results: Record<string, unknown>[]; returned: number; nextOffset: number | null };
    assert.ok(Buffer.byteLength(JSON.stringify(data)) < 101000);
    return { result, data };
  };
  try {
    for (const lang of Object.keys(c.names)) {
      const { result, data } = await run({ limit: 1, lang });
      assert.equal(data.returned, 1);
      assert.equal(typeof data.results[0].name, "string");
      assert.equal(data.results[0].name, data.results[0][c.names[lang as keyof typeof c.names]]);
      assert.ok(Number.isSafeInteger(data.results[0][c.oid]));
      console.log(JSON.stringify({ mode, api: c.api, lang, status: "PASS", source: result.meta.source, name: data.results[0].name })); checks++;
    }
    const { result, data } = await run({ limit: 1, offset: 1, geometry: true, lang: "tc" });
    assert.equal(data.returned, 1); assert.equal(data.results[0].OBJECTID, 2);
    assert.ok(data.results[0].geometry || data.results[0].geometryOmitted);
    console.log(JSON.stringify({ mode, api: c.api, check: "pagination-geometry", status: "PASS", source: result.meta.source })); checks++;
    const selected = await run({ objectId: 1, bbox: "113,21,115,23", limit: 1 });
    assert.equal(selected.data.results[0].OBJECTID, 1); checks++;
    if (mode === "simulation") {
      for (const [failure, code] of [["http", "upstream_http"], ["json", "upstream_parse"], ["malformed", "upstream_parse"], ["arcgis", "upstream_http"], ["timeout", "upstream_timeout"]]) {
        const failing = { ...tool, spec: { ...tool.spec, headers: { "x-fixture-failure": failure }, ...(failure === "timeout" ? { timeoutMs: 50 } : {}) } };
        await assert.rejects(executeTool(service, failing, {}), { code }); checks++;
      }
      const empty = { ...tool, spec: { ...tool.spec, headers: { "x-fixture-failure": "empty" } } };
      assert.deepEqual(((await executeTool(service, empty, {})).data as { results: unknown[] }).results, []); checks++;
      await assert.rejects(executeTool(service, tool, { limit: 101 })); checks++;
      await assert.rejects(executeTool(service, tool, { lang: "sc" })); checks++;
      await assert.rejects(executeTool(service, { ...tool, spec: { ...tool.spec, baseUrl: "http://127.0.0.1:1/census" } }, {}), { code: "upstream_network" }); checks++;
    }
    console.log(JSON.stringify({ mode, api: c.api, status: "PASS" }));
  } catch (error) { failures++; console.error(JSON.stringify({ mode, api: c.api, status: "FAIL", error: String(error) })); }
}
globalThis.fetch = nativeFetch;
setCacheForTesting(null);
console.log(JSON.stringify({ mode, passedChecks: checks, failedAPIs: failures }));
if (failures) process.exitCode = 1;
