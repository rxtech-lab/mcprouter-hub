/** Read-only live verification through generated schemas, runtime, handlers and real fetcher. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { services } from "../generated/registry";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";
import { liveCases } from "../mcp/live-checks";
import type { ToolInput } from "../lib/mcp/types";

const ids = new Set(Array.from({ length: 10 }, (_, i) => `API-${1833 + i}`));
const targets = services.filter((s) => s.apis.some((id) => ids.has(id)));
const apiByTool: Record<string, string> = {
  epd_recent_marine_water_quality: "API-1833", epd_recyclable_collection_points: "API-1834",
  epd_recent_river_water_quality: "API-1838", epd_chemical_waste_collectors: "API-1839",
  epd_clinical_waste_collectors: "API-1840", epd_construction_noise_permits: "API-1841",
  epd_pollution_complaint_statistics: "API-1842",
};
type Page = { results: Record<string, unknown>[]; returned: number; hasMore: boolean; nextOffset: number | null; source: string; total?: number };
const evidence: Record<string, unknown>[] = [];
let requests = 0;
let failures = 0;
const startedAt = new Date().toISOString();
const fetchActual = globalThis.fetch;
globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => { requests++; return fetchActual(input, init); }) as typeof fetch;
// Every probe reaches the real upstream, independently of previous cached results.
setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
try {
  await Promise.all(targets.map(async (service) => {
    for (const tool of service.tools) {
      const langs = tool.spec.input.lang?.enum ?? ["en"];
      const variants = langs.flatMap((lang) => tool.name.includes("historical") ? [{ lang, year: 1986 }, { lang, year: 2025 }] : [{ lang }]);
      for (const variant of variants) {
        let check = "initial";
        try {
          const run = async (input: ToolInput): Promise<Page> => {
            const result = await executeTool(service, tool, input);
            const page = result.data as Page;
            assert.equal(page.returned, page.results.length);
            assert.ok(page.returned <= Number(input.limit ?? 20));
            assert.ok(Buffer.byteLength(JSON.stringify(page)) < 101000);
            return page;
          };
          const first = await run({ ...variant, limit: 1 });
          assert.equal(first.returned, 1, "Expected a real dataset record");
          assert.equal(liveCases[tool.name].check?.({ data: first, meta: {} }), null);
          const row = first.results[0];
          check = "pagination";
          assert.equal(first.nextOffset, 1);
          const second = await run({ ...variant, limit: 1, offset: 1 });
          const combined = await run({ ...variant, limit: 2 });
          assert.deepEqual([...first.results, ...second.results], combined.results);
          assert.notDeepEqual(first.results, second.results);
          check = "empty-page";
          const empty = await run({ ...variant, limit: 1, offset: 1000000 });
          assert.deepEqual(empty.results, []);
          assert.equal(empty.hasMore, false);
          assert.equal(empty.nextOffset, null);
          check = "known-record-filter";
          if (typeof row.station === "string") {
            const filtered = await run({ ...variant, limit: 1, station: row.station.toLowerCase(), search: row.station,
              ...(tool.name.includes("historical") ? {} : { month: String(row.date).slice(5) + "/" + String(row.date).slice(0, 4) }) });
            assert.deepEqual(filtered.results, first.results);
          } else {
            const filtered = await run({ ...variant, limit: 1, objectId: row.OBJECTID, search: String(row.name).slice(0, 60) });
            assert.deepEqual(filtered.results, first.results);
            check = "bbox-and-geometry";
            const spatial = await run({ ...variant, limit: 1, bbox: "113.8,22.1,114.5,22.6", geometry: true });
            assert.equal(spatial.returned, 1);
            assert.ok(spatial.results[0].geometry || spatial.results[0].geometryOmitted);
          }
          const event = { tool: tool.name, variant, status: "passed", checks: ["initial", "pagination", "empty-page", "known-record-filter", ...(typeof row.station === "string" ? [] : ["bbox-and-geometry"])],
            apis: [tool.name.includes("historical") ? { en: "API-1835", sc: "API-1836", tc: "API-1837" }[String(variant.lang)] : apiByTool[tool.name]],
            source: first.source, total: first.total, fields: Object.keys(row).sort() };
          evidence.push(event); console.log(JSON.stringify(event));
        } catch (error) {
          failures++;
          const e = error as Error & { code?: string; status?: number };
          const event = { tool: tool.name, variant, status: "failed", check, code: e.code, httpStatus: e.status, message: e.message.slice(0, 250) };
          evidence.push(event); console.log(JSON.stringify(event));
        }
      }
    }
  }));
} finally { globalThis.fetch = fetchActual; setCacheForTesting(null); }
const summary = { startedAt, finishedAt: new Date().toISOString(), variants: evidence.length, passed: evidence.length - failures, failed: failures, realHttpRequests: requests, localLiveVerified: failures === 0, independentRxCodeVerification: "pending", evidence };
if (process.env.ENVIRONMENT021_LIVE_REPORT) writeFileSync(process.env.ENVIRONMENT021_LIVE_REPORT, JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify({ ...summary, evidence: undefined }));
if (failures) process.exitCode = 1;
