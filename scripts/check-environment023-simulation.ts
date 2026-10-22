/** Production handlers and fetcher over real loopback HTTP, served by Postman. */
import assert from "node:assert/strict";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";
import { spatialCases023, fileCases023, definition023 } from "../tests/environment023-cases";
const root = process.env.ENVIRONMENT023_SIM_URL ?? "http://127.0.0.1:4923/upstream";
assert.match(root, /^http:\/\/(127\.0\.0\.1|localhost):\d+\/upstream$/);
const actualFetch = globalThis.fetch;
let failure = "";
let requests = 0;
globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input));
  assert.ok(["portal.csdi.gov.hk", "data.weather.gov.hk", "www.had.gov.hk"].includes(url.hostname));
  requests++;
  return actualFetch(`${root}${url.pathname}${url.search}`, { ...init, headers: { ...init?.headers, "x-fixture-failure": failure } });
}) as typeof fetch;
setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
const cases = [...spatialCases023, ...fileCases023];
try {
  for (const c of cases) {
    const { service, tool } = definition023(c.tool);
    failure = "";
    const result = (await executeTool(service, tool, c.input)).data as { results: unknown[]; returned: number; hasMore: boolean; nextOffset: number | null };
    assert.equal(result.returned, 2); assert.equal(result.nextOffset, c.kind === "spatial" ? null : 2);
    if ("data" in c) assert.deepEqual(result.results, c.data.results);
    const second = (await executeTool(service, tool, { ...c.input, limit: 1, offset: 1 })).data as typeof result;
    assert.deepEqual(second.results, result.results.slice(1, 2));
    const empty = (await executeTool(service, tool, { ...c.input, offset: 1000000 })).data as typeof result;
    assert.deepEqual(empty.results, []); assert.equal(empty.hasMore, false); assert.equal(empty.nextOffset, null);
    for (const [variant, code] of [["http", "upstream_http"], ["parse", "upstream_parse"], ["malformed", "upstream_parse"]]) {
      failure = variant; await assert.rejects(executeTool(service, tool, c.input), { code });
    }
    const before = requests;
    await assert.rejects(executeTool(service, tool, { ...c.input, limit: 101 })); assert.equal(requests, before);
  }
  console.log(JSON.stringify({ passed: true, variants: cases.length, realHttpRequests: requests, invalidInputsRejected: cases.length }));
} finally { globalThis.fetch = actualFetch; setCacheForTesting(null); }
