/** Runs production adapters against live providers or a local Postman simulation. Never retries. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";
import { cases025, definition025 } from "../tests/health025-cases";
const simulation = process.env.HEALTH025_SIM_URL;
if (simulation) assert.match(simulation, /^http:\/\/127\.0\.0\.1:\d+\/upstream$/);
const actualFetch = globalThis.fetch;
let failure = "";
let requests = 0;
const events: Record<string, unknown>[] = [];
const failed = new Set<string>();
let store = new Map<string, unknown>();
setCacheForTesting({ get: async (k) => store.get(k) ?? null, set: async (k, v) => void store.set(k, v), delete: async () => {}, expireTag: async () => {} });
globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input));
  assert.ok(["www.censtatd.gov.hk", "portal.csdi.gov.hk", "www.chp.gov.hk"].includes(url.hostname));
  requests++;
  return actualFetch(simulation ? `${simulation}${url.pathname}${url.search}` : input, simulation ? { ...init, headers: { ...init?.headers, "x-fixture-failure": failure } } : init);
}) as typeof fetch;
type Page = { results: Record<string, unknown>[]; returned: number; total: number; hasMore: boolean; nextOffset: number | null; language: string };
const startedAt = new Date().toISOString();
try {
  for (const c of cases025) {
    if (failed.has(c.id)) continue;
    const checks: string[] = [];
    try {
      const { service, tool } = definition025(c.tool);
      const run = async (input = c.input as Record<string, unknown>) => (await executeTool(service, tool, input)).data as Page;
      const first = await run();
      assert.equal(first.returned, 2); assert.equal(first.nextOffset, 2); assert.ok(first.total >= 2);
      assert.equal(first.language,c.input.lang); assert.ok(Buffer.byteLength(JSON.stringify(first)) < 105000); checks.push("bounded-source-records");
      if (c.kind === "statistics") {
        assert.ok(first.results[0].svDesc); assert.ok(first.results[0].sd_value !== undefined);
      } else if (c.kind === "clinics") {
        const suffix = { en: "EN", tc: "TC", sc: "SC" }[c.input.lang]!;
        assert.equal(first.results[0].name,first.results[0][`Name_${suffix}`]);
        assert.equal(first.results[0].address,first.results[0][`Address_${suffix}`]);
      } else assert.ok(first.results[0].AandB_proportion);
      checks.push("source-values-and-language");
      const before = requests;
      const second = await run({...c.input,limit:1,offset:1}); assert.deepEqual(second.results,first.results.slice(1));
      const empty = await run({...c.input,offset:100000}); assert.deepEqual(empty.results,[]); assert.equal(empty.nextOffset,null); assert.equal(empty.hasMore,false);
      const none = await run({...c.input,search:"unmatchable-health025-value"}); assert.deepEqual(none.results,[]);
      assert.equal(requests,before); checks.push("pagination-empty-filter-cache");
      await assert.rejects(run({...c.input,limit:101})); await assert.rejects(run({...c.input,lang:"fr"})); assert.equal(requests,before); checks.push("invalid-input-before-http");
      if (simulation) {
        for (const [variant,code] of [["http","upstream_http"],["html","upstream_parse"],["malformed","upstream_parse"],["empty",""]]) {
          failure=variant; store=new Map();
          if (variant === "empty") assert.deepEqual((await run()).results,[]);
          else await assert.rejects(run(),{code});
        }
        failure=""; store=new Map(); checks.push("http-html-malformed-empty-faults");
      }
      events.push({id:c.id,tool:c.tool,lang:c.input.lang,status:"passed",source:c.request.url,total:first.total,checks});
    } catch (error) {
      failed.add(c.id);
      const e=error as Error & { code?: string; status?: number };
      events.push({id:c.id,lang:c.input.lang,status:"failed",code:e.code,httpStatus:e.status,message:e.message,checks});
    }
  }
} finally { globalThis.fetch=actualFetch; setCacheForTesting(null); }
const report={startedAt,finishedAt:new Date().toISOString(),mode:simulation?"simulation":"live",realHttpRequests:requests,passed:events.filter((e)=>e.status==="passed").length,failed:failed.size,repairCycles:2,independentRxCodeVerification:"pending",events};
writeFileSync(process.env.HEALTH025_REPORT ?? "/tmp/batch025-evidence/live.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report));
if (failed.size) process.exitCode=1;
