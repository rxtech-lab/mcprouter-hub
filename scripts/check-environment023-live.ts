/** Read-only production-runtime probes. A genuine API failure stops that ID; no retries. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";
import { entries023, definition023 } from "../tests/environment023-cases";
import type { ToolInput } from "../lib/mcp/types";
type Page = { results: Record<string, unknown>[]; returned: number; nextOffset: number | null; hasMore: boolean; source: string };
const evidence: Record<string, unknown>[] = [];
let requests = 0;
const actualFetch = globalThis.fetch;
globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => { requests++; return actualFetch(input, init); }) as typeof fetch;
setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
const startedAt = new Date().toISOString();
try {
  await Promise.all(entries023.map(async (entry) => {
    let stage = "initial";
    const checks: string[] = [];
    try {
      const { service, tool } = definition023(entry.tool);
      const run = async (input: ToolInput) => {
        const data = (await executeTool(service, tool, input)).data as Page;
        assert.equal(data.returned, data.results.length); assert.ok(data.returned <= Number(input.limit ?? 20));
        assert.ok(Buffer.byteLength(JSON.stringify(data)) < 110000); return data;
      };
      const initial = await run({ limit: 2 }); assert.equal(initial.returned, 2); checks.push(stage);
      stage = "pagination";
      const first = await run({ limit: 1 }); const second = await run({ limit: 1, offset: 1 });
      assert.deepEqual([...first.results, ...second.results], initial.results); assert.equal(first.nextOffset, 1); checks.push(stage);
      stage = "empty-page";
      const empty = await run({ limit: 2, offset: 1000000 }); assert.deepEqual(empty.results, []); assert.equal(empty.nextOffset, null); assert.equal(empty.hasMore, false); checks.push(stage);
      stage = "known-record-search";
      const row = first.results[0];
      const name = row.name ?? row.station ?? row.telephone;
      const found = await run({ limit: 1, search: String(name).slice(0, 30), ...(entry.kind === "spatial" ? { objectId: row.OBJECTID } : {}) });
      assert.deepEqual(found.results[0], row); checks.push(stage);
      if (entry.kind === "spatial") {
        stage = "geometry-and-bbox";
        const geo = await run({ limit: 1, bbox: "113,22,115,23", geometry: true });
        assert.equal(geo.returned, 1); assert.ok(geo.results[0].geometry || geo.results[0].geometryOmitted); checks.push(stage);
      }
      stage = "languages";
      const languages = entry.kind === "spatial" ? Object.keys(entry.names!) : ["en", "tc", "sc"];
      for (const lang of languages) {
        const data = await run({ limit: 1, lang }); assert.equal(data.returned, 1);
        if (entry.kind === "spatial") assert.equal(data.results[0].name, data.results[0][entry.names![lang as keyof typeof entry.names]!]);
      }
      checks.push(stage);
      const event = { id: entry.id, tool: entry.tool, status: "passed", source: initial.source, checks, fields: Object.keys(row) };
      evidence.push(event); console.log(JSON.stringify(event));
    } catch (error) {
      const e = error as Error & { code?: string; status?: number };
      const event = { id: entry.id, tool: entry.tool, status: "failed", stage, checks, code: e.code, httpStatus: e.status, message: e.message.slice(0, 500) };
      evidence.push(event); console.log(JSON.stringify(event));
    }
  }));
} finally { globalThis.fetch = actualFetch; setCacheForTesting(null); }
const failed = evidence.filter((e) => e.status === "failed").length;
const summary = { startedAt, finishedAt: new Date().toISOString(), passed: evidence.length - failed, failed, realHttpRequests: requests, repairCycles: 2, independentRxCodeVerification: "pending", evidence };
writeFileSync(process.env.ENVIRONMENT023_LIVE_REPORT ?? "/tmp/environment023-live.json", JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify({ ...summary, evidence: undefined }));
if (failed) process.exitCode = 1;
