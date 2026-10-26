/** bun --conditions=react-server scripts/check-batch094.ts captures|simulation|live */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { services } from "../generated/registry";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";
import manifest from "../tests/fixtures/batch094/manifest.json";
import type { ToolDefinition } from "../lib/mcp/types";

const mode = process.argv[2];
assert.ok(["captures", "simulation", "live"].includes(mode));
const evidence = process.env.BATCH094_EVIDENCE_DIR ?? "/private/tmp/batch094-evidence";
const originalFetch = globalThis.fetch;
setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
const service = services.find((s) => s.id === "censtatd-population-vital")!;
let checks = 0;
let failures = 0;
if (mode === "captures") {
  globalThis.fetch = async (url) => {
    const u = new URL(String(url));
    const file = `${u.searchParams.get("id")}-${u.searchParams.get("lang")}.json`;
    const c = manifest.find((c) => c.captureFile === file)!;
    const bytes = readFileSync(`${evidence}/${file}`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), c.sourceSha256);
    return new Response(bytes);
  };
}
if (mode === "live") {
  mkdirSync(`${evidence}/live`, { recursive: true });
  globalThis.fetch = async (url, init) => {
    const response = await originalFetch(url, init);
    const bytes = Buffer.from(await response.clone().arrayBuffer());
    const u = new URL(String(url)); const file = `${u.searchParams.get("id")}-${u.searchParams.get("lang")}.json`;
    writeFileSync(`${evidence}/live/${file}`, bytes);
    writeFileSync(`${evidence}/live/${file}.meta`, JSON.stringify({ url: String(url), status: response.status, sha256: createHash("sha256").update(bytes).digest("hex"), captured: new Date().toISOString() }));
    return response;
  };
}
for (const c of manifest) {
  const original = service.tools.find((t) => t.name === c.tool)!;
  const tool: ToolDefinition = mode === "simulation" ? { ...original, spec: { ...original.spec, baseUrl: "http://127.0.0.1:4994/census/api" } } : original;
  try {
    const result = await executeTool(service, tool, { lang: c.lang, limit: 100 });
    const data = result.data as { table: string; language: string; results: Record<string, unknown>[]; returned: number; total: number; nextOffset: number | null };
    assert.equal(data.table, c.table); assert.equal(data.language, c.lang); assert.ok(data.returned > 0 && data.returned <= 100);
    if (mode !== "simulation") assert.equal(data.total, c.sourceRows);
    checks++;
    if (mode === "captures") {
      const source = JSON.parse(readFileSync(`${evidence}/${c.captureFile}`, "utf8"));
      const { normalize } = await import("../mcp/services/censtatd-population-vital/handlers");
      const { handlerContext } = await import("../lib/mcp/runtime");
      const expected = [...source.dataSet].sort((a, b) => String(b.period).localeCompare(String(a.period)));
      const rows = [...data.results]; let offset = data.nextOffset;
      while (offset !== null) {
        // Already verified transport/hash and full-dataset validation above. Replay
        // remaining pages directly to avoid rereading/parsing megabytes per page.
        const page = await normalize(source, { lang: c.lang, limit: 100, offset }, handlerContext(service, tool)) as typeof data;
        assert.ok(page.returned > 0 && page.returned <= 100); assert.ok(page.results.reduce((n, r) => n + Buffer.byteLength(JSON.stringify(r)), 0) <= 100000);
        rows.push(...page.results); offset = page.nextOffset;
      }
      assert.equal(rows.length, expected.length);
      rows.forEach((row, i) => { const { measure, ...original } = row; assert.equal(typeof measure, "string"); assert.deepEqual(original, expected[i]); }); checks++;
    }
    if (mode === "simulation") {
      for (const [failure, code] of [["http", "upstream_http"], ["json", "upstream_parse"], ["provider", "upstream_http"], ["malformed", "upstream_parse"], ["timeout", "upstream_timeout"]]) {
        const failed = { ...tool, spec: { ...tool.spec, headers: { "x-fixture-failure": failure }, ...(failure === "timeout" ? { timeoutMs: 50 } : {}) } };
        await assert.rejects(executeTool(service, failed, { lang: c.lang }), { code }); checks++;
      }
      const empty = { ...tool, spec: { ...tool.spec, headers: { "x-fixture-failure": "empty" } } };
      assert.deepEqual(((await executeTool(service, empty, { lang: c.lang })).data as typeof data).results, []); checks++;
      await assert.rejects(executeTool(service, tool, { limit: 101 })); checks++;
      await assert.rejects(executeTool(service, { ...tool, spec: { ...tool.spec, baseUrl: "http://127.0.0.1:1/census/api" } }, {}), { code: "upstream_network" }); checks++;
    }
    console.log(JSON.stringify({ mode, api: c.api, lang: c.lang, total: data.total, status: "PASS" }));
  } catch (error) { failures++; console.error(JSON.stringify({ mode, api: c.api, lang: c.lang, status: "FAIL", error: String(error) })); }
}
globalThis.fetch = originalFetch; setCacheForTesting(null);
console.log(JSON.stringify({ mode, passedChecks: checks, failedCases: failures }));
if (failures) process.exitCode = 1;
