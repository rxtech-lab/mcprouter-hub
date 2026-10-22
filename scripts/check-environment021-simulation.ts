/** Actual generated executors over loopback HTTP served by Postman; no fetch replies stubbed. */
import assert from "node:assert/strict";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";
import { definition021, environmentCases, spatial021 } from "../tests/environment021-cases";

const root = process.env.ENVIRONMENT021_SIM_URL ?? "http://127.0.0.1:4921/upstream";
assert.match(root, /^http:\/\/(127\.0\.0\.1|localhost):\d+\/upstream$/);
const actualFetch = globalThis.fetch;
let failure = "";
let requests = 0;
// Handlers use fixed official URLs. Redirect only those hosts to loopback; execute
// the unmodified generated schemas, handlers, runtime, parsers and fetcher.
const officialHosts = new Set(["portal.csdi.gov.hk", "cd.epic.epd.gov.hk"]);
globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input));
  assert.ok(officialHosts.has(url.hostname));
  requests++;
  return actualFetch(`${root}${url.pathname}${url.search}`, { ...init, headers: { ...init?.headers, "x-fixture-failure": failure } });
}) as typeof fetch;
setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
try {
  for (const c of environmentCases) {
    const { service, tool } = definition021(c.tool);
    failure = "";
    const result = (await executeTool(service, tool, c.input)).data as { results: unknown[]; returned: number; hasMore: boolean; nextOffset: number | null };
    assert.equal(result.returned, 2);
    assert.deepEqual(result.results, c.data.results);
    const second = (await executeTool(service, tool, { ...c.input, limit: 1, offset: 1 })).data as typeof result;
    assert.deepEqual(second.results, result.results.slice(1, 2));
    const empty = (await executeTool(service, tool, { ...c.input, offset: 100 })).data as typeof result;
    assert.deepEqual(empty.results, []);
    assert.equal(empty.hasMore, false);
    assert.equal(empty.nextOffset, null);
    for (const [variant, code] of [["http", "upstream_http"], ["parse", "upstream_parse"],
      ...(spatial021.some((s) => s.tool === c.tool) ? [["provider", "upstream_http"], ["feature", "upstream_parse"]] : [])]) {
      failure = variant;
      await assert.rejects(executeTool(service, tool, c.input), { code });
    }
    const before = requests;
    await assert.rejects(executeTool(service, tool, { ...c.input, limit: 101 }));
    assert.equal(requests, before);
  }
  console.log(JSON.stringify({ passed: true, variants: environmentCases.length, realHttpRequests: requests, invalidInputsRejected: environmentCases.length }));
} finally { globalThis.fetch = actualFetch; setCacheForTesting(null); }
