/** Read-only production-runtime validation; stop an ID at the first failure. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";
import { entries024, definition024 } from "../tests/environment024-cases";
import type { ToolInput } from "../lib/mcp/types";
type Page = { results: Record<string, unknown>[]; returned: number; nextOffset: number | null; hasMore: boolean; source?: string };
const actualFetch = globalThis.fetch;
const evidence: Record<string, unknown>[] = [];
const store = new Map<string, unknown>();
const requests: { url: string; status?: number; error?: string }[] = [];
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const event: (typeof requests)[number] = { url: String(input) }; requests.push(event);
  try { const response = await actualFetch(input, init); event.status = response.status; return response; }
  catch (error) { event.error = String(error); throw error; }
}) as typeof fetch;
setCacheForTesting({ get: async (k) => store.get(k) ?? null, set: async (k, v) => void store.set(k, v), delete: async () => {}, expireTag: async () => {} });
const startedAt = new Date().toISOString();
try {
  await Promise.all(entries024.map(async (entry) => {
    let stage = "initial"; const checks: string[] = [];
    try {
      const run = async (input: ToolInput, name = entry.tool) => {
        const { service, tool } = definition024(name);
        const d = (await executeTool(service, tool, input)).data as Page;
        assert.equal(d.returned, d.results.length); assert.ok(d.returned <= Number(input.limit ?? 20));
        assert.ok(Buffer.byteLength(JSON.stringify(d)) < 110000); return d;
      };
      const initial = await run({ limit: 2 }); assert.equal(initial.returned, 2); checks.push(stage);
      stage = "pagination";
      const a = await run({ limit: 1 }); const b = await run({ limit: 1, offset: 1 });
      assert.deepEqual([...a.results, ...b.results], initial.results); assert.equal(a.nextOffset, 1); checks.push(stage);
      stage = "empty-page";
      const empty = await run({ limit: 2, offset: 1000000 }); assert.deepEqual(empty.results, []); assert.equal(empty.nextOffset, null); assert.equal(empty.hasMore, false); checks.push(stage);
      const row = a.results[0];
      if (entry.kind === "spatial") {
        stage = "objectId-bbox-geometry";
        const geo = await run({ limit: 1, objectId: row.OBJECTID, bbox: "113,22,115,23", geometry: true });
        assert.equal(geo.returned, 1); assert.equal(geo.results[0].OBJECTID, row.OBJECTID); assert.ok(geo.results[0].geometry); checks.push(stage);
        for (const field of entry.fields ?? []) {
          stage = `search-${field}`;
          const found = await run({ limit: 1, objectId: row.OBJECTID, searchField: field, search: String(row[field]).slice(0, 25) });
          assert.deepEqual(found.results[0], row); checks.push(stage);
        }
      } else if (entry.kind === "census") {
        stage = "series-period-dimensions";
        const dims = Object.keys(row).filter((k) => !["freq", "period", "sv", "svDesc", "figure", "sd_value", "measure"].includes(k) && !k.endsWith("Desc"));
        const filters = Object.fromEntries(dims.map((k) => [k, row[k] === "" ? "TOTAL" : row[k]]));
        assert.deepEqual((await run({ limit: 1, period: row.period, freq: row.freq, indicator: row.sv, ...filters })).results[0], row); checks.push(stage);
      } else {
        stage = "year-metric";
        assert.deepEqual((await run({ limit: 1, year: row.year, search: row.metric })).results[0], row); checks.push(stage);
      }
      stage = "languages";
      for (const lang of entry.languages) assert.equal((await run({ limit: 1, lang })).returned, 1);
      checks.push(stage);
      if (entry.id === "API-3368") {
        for (const season of ["annual", "winter", "summer"]) {
        for (const height of [200, 300, 500]) {
          stage = `profile-${season}-${height}`;
          const p = await run({ objectId: row.OBJECTID, season, height, limit: 2 }, "pland_site_wind_profile");
          assert.equal(p.returned, 2); assert.equal(p.results[0].speedBand, "00_to_01"); checks.push(stage);
        }
        }
        stage = "profile-paging";
        const p = await run({ objectId: row.OBJECTID, limit: 2 }, "pland_site_wind_profile");
        const q = await run({ objectId: row.OBJECTID, limit: 1, offset: 1 }, "pland_site_wind_profile");
        assert.deepEqual(q.results[0], p.results[1]); checks.push(stage);
      }
      const event = { id: entry.id, status: "passed", tool: entry.tool, checks, source: initial.source, fields: Object.keys(row) }; evidence.push(event); console.log(JSON.stringify(event));
    } catch (error) {
      const e = error as Error & { code?: string; status?: number };
      const event = { id: entry.id, status: "failed", stage, checks, code: e.code, httpStatus: e.status, message: e.message }; evidence.push(event); console.log(JSON.stringify(event));
    }
  }));
} finally { globalThis.fetch = actualFetch; setCacheForTesting(null); }
const summary = { startedAt, finishedAt: new Date().toISOString(), passed: evidence.filter((e) => e.status === "passed").length, failed: evidence.filter((e) => e.status === "failed").length, repairCycles: 1, excluded: [{ id: "API-3365", status: "failed", reason: "Official CSDI FeatureServer returned HTTP 200 with error code 500, null message and empty details; no retry." }], evidence, requests };
writeFileSync(process.env.ENVIRONMENT024_LIVE_REPORT ?? "/private/tmp/batch024-evidence/runtime-live.json", JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify({ ...summary, evidence: undefined, requests: requests.length }));
if (summary.failed) process.exitCode = 1;
