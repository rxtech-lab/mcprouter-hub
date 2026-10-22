/** Read-only probes through generated schemas, production handlers, cache adapter and fetcher. No retries. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";
import { cases022, definition022 } from "../tests/environment022-cases";
import type { ToolInput } from "../lib/mcp/types";

type Page = { results: Record<string, unknown>[]; returned: number; hasMore: boolean; nextOffset: number | null; source: string };
const evidence: Record<string, unknown>[] = [];
let requests = 0;
const actualFetch = globalThis.fetch;
globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => { requests++; return actualFetch(input, init); }) as typeof fetch;
setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
const startedAt = new Date().toISOString();
try {
  // Each API is processed sequentially; a genuine failure ends that API's probes.
  const ids = [...new Set(cases022.map((c) => c.id))];
  await Promise.all(ids.map(async (id) => {
    let stage = "initial";
    let current = "";
    try {
      for (const c of cases022.filter((item) => item.id === id)) {
        current = c.file;
        const { service, tool } = definition022(c.tool);
        const run = async (input: ToolInput): Promise<Page> => {
          const result = (await executeTool(service, tool, input)).data as Page;
          assert.equal(result.returned, result.results.length);
          assert.ok(result.returned <= Number(input.limit ?? 20));
          assert.ok(Buffer.byteLength(JSON.stringify(result)) < 101000);
          return result;
        };
        stage = "initial";
        const first = await run({ ...c.input, limit: 1 });
        assert.equal(first.returned, 1);
        stage = "pagination";
        const second = await run({ ...c.input, limit: 1, offset: 1 });
        const combined = await run(c.input);
        assert.deepEqual([...first.results, ...second.results], combined.results);
        assert.equal(first.nextOffset, second.returned ? 1 : null);
        stage = "empty-page";
        const empty = await run({ ...c.input, offset: 1000000 });
        assert.deepEqual(empty.results, []); assert.equal(empty.hasMore, false); assert.equal(empty.nextOffset, null);
        stage = "known-record-search-and-object-id";
        const row = first.results[0];
        const filtered = await run({ ...c.input, limit: 1, objectId: row[c.sublayer.objectIdField], search: String(row.name).slice(0, 30) });
        assert.deepEqual(filtered.results, first.results);
        stage = "bbox-and-geometry";
        const geo = await run({ ...c.input, limit: 1, bbox: "113.8,22.1,114.6,22.7", geometry: true });
        assert.equal(geo.returned, 1); assert.ok(geo.results[0].geometry || geo.results[0].geometryOmitted);
        stage = "language-projection";
        for (const [lang, field] of Object.entries(c.names)) {
          const localized = await run({ ...c.input, limit: 1, lang });
          assert.equal(localized.results[0].name, localized.results[0][c.habitats ? c.sublayer.fields.report : field]);
        }
        const event = { api: id, tool: c.tool, layer: c.sublayer.id, layerName: c.sublayer.name, status: "passed", source: first.source,
          checks: ["initial", "pagination", "empty-page", "known-record-search-and-object-id", "bbox-and-geometry", "language-projection"], fields: Object.keys(row).sort() };
        evidence.push(event); console.log(JSON.stringify(event));
      }
    } catch (error) {
      const e = error as Error & { code?: string; status?: number };
      const event = { api: id, fixture: current, status: "failed", stage, code: e.code, httpStatus: e.status, message: e.message.slice(0, 400) };
      evidence.push(event); console.log(JSON.stringify(event));
    }
  }));
} finally { globalThis.fetch = actualFetch; setCacheForTesting(null); }
const failed = evidence.filter((e) => e.status === "failed").length;
const summary = { startedAt, finishedAt: new Date().toISOString(), passed: evidence.length - failed, failed, realHttpRequests: requests, independentRxCodeVerification: "pending", evidence };
if (process.env.ENVIRONMENT022_LIVE_REPORT) writeFileSync(process.env.ENVIRONMENT022_LIVE_REPORT, JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify({ ...summary, evidence: undefined }));
if (failed) process.exitCode = 1;
