/** Production executor: live upstream checks or a local Postman fixture replay. No retries. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { services } from "../generated/registry";
import type { ToolInput } from "../lib/mcp/types";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";

const simulation = process.env.HEALTH027_SIM_URL;
const cases027 = JSON.parse(readFileSync("tests/fixtures/health027/manifest.json", "utf8")) as { id: string; tool: string; input: ToolInput; url: string }[];
function definition027(name: string) {
  const service = services.find((s) => s.tools.some((t) => t.name === name))!;
  return { service, tool: service.tools.find((t) => t.name === name)! };
}
if (simulation) assert.match(simulation, /^http:\/\/127\.0\.0\.1:\d+\/health$/);
const actualFetch = globalThis.fetch;
let failure = "";
let requests = 0;
const cache = new Map<string, unknown>();
setCacheForTesting({ get: async (k) => cache.get(k) ?? null, set: async (k, v) => void cache.set(k, v), delete: async () => {}, expireTag: async () => {} });
globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
  requests++;
  if (!simulation) return actualFetch(input, init);
  const url = new URL(String(input));
  assert.ok(["www.ha.org.hk","portal.csdi.gov.hk"].includes(url.hostname));
  return actualFetch(`${simulation}${url.pathname}${url.search}`, { ...init, headers: { ...init?.headers, "x-fixture-failure": failure } });
}) as typeof fetch;
type Page = { returned: number; total: number; nextOffset: number | null; results: Record<string, unknown>[]; hasMore: boolean };
const evidence: Record<string, unknown>[] = [];
const failedIds = new Set<string>();
try {
  for (const c of cases027) {
    if (failedIds.has(c.id)) continue;
    const { service, tool } = definition027(c.tool);
    try {
      failure = "";
      // Injected malformed bodies are raw-cacheable; isolate simulation scenarios.
      if (simulation) cache.clear();
      const first = (await executeTool(service,tool,c.input)).data as Page;
      assert.equal(first.returned,2); assert.equal(first.results.length,2); assert.ok(first.total >= 3);
      assert.ok(Buffer.byteLength(JSON.stringify(first)) < 85000);
      const second = (await executeTool(service,tool,{...c.input,limit:1,offset:1})).data as Page;
      assert.deepEqual(second.results,first.results.slice(1));
      const empty = (await executeTool(service,tool,{...c.input,search:"unmatchable-health027-value"})).data as Page;
      assert.deepEqual(empty.results,[]); assert.equal(empty.nextOffset,null);
      const exhausted = (await executeTool(service,tool,{...c.input,offset:100000})).data as Page;
      assert.equal(exhausted.returned,0); assert.equal(exhausted.hasMore,false);
      if (simulation) {
        for (const [variant,code] of [["http","upstream_http"],["parse","upstream_parse"],["malformed","upstream_parse"]]) {
          failure=variant; cache.clear();
          await assert.rejects(executeTool(service,tool,c.input),{code});
        }
      }
      const before=requests;
      await assert.rejects(executeTool(service,tool,{...c.input,limit:101})); assert.equal(requests,before);
      evidence.push({id:c.id,tool:c.tool,input:c.input,source:c.url,status:"passed",total:first.total,fields:Object.keys(first.results[0])});
    } catch (error) {
      failedIds.add(c.id);
      evidence.push({id:c.id,tool:c.tool,input:c.input,status:"failed",message:(error as Error).message});
    }
  }
  const report={mode:simulation?"Postman local HTTP":"live",checkedAt:new Date().toISOString(),passed:evidence.filter((e)=>e.status==="passed").length,failedIds:[...failedIds],requests,evidence};
  if (process.env.HEALTH027_REPORT) writeFileSync(process.env.HEALTH027_REPORT,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({...report,evidence:undefined}));
  for (const e of evidence.filter((e)=>e.status==="failed")) console.error(JSON.stringify(e));
  if(failedIds.size) process.exitCode=1;
} finally { globalThis.fetch=actualFetch; setCacheForTesting(null); }
