/** Production runtime and fetcher over actual loopback HTTP served by Postman. */
import assert from "node:assert/strict";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";
import { cases024, definition024, profileCase024 } from "../tests/environment024-cases";
const root = process.env.ENVIRONMENT024_SIM_URL ?? "http://127.0.0.1:4924/upstream";
assert.match(root, /^http:\/\/(127\.0\.0\.1|localhost):\d+\/upstream$/);
const actualFetch = globalThis.fetch;
let failure = "", requests = 0;
globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input));
  assert.ok(["portal.csdi.gov.hk", "www.censtatd.gov.hk", "www.pland.gov.hk", "appapi.towngas.com"].includes(url.hostname)); requests++;
  return actualFetch(`${root}${url.pathname}${url.search}`, { ...init, headers: { ...init?.headers, "x-fixture-failure": failure } });
}) as typeof fetch;
setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
try {
  for (const c of cases024) {
    const { service, tool } = definition024(c.tool); failure = "";
    const result = (await executeTool(service, tool, c.input)).data as { results: unknown[]; returned: number; nextOffset: number | null; hasMore: boolean };
    // The mock pages the captured spatial sample, while raw fixtures retain original exceededTransferLimit.
    assert.deepEqual(result.results, c.data.results); assert.equal(result.returned, 3);
    const second = (await executeTool(service, tool, { ...c.input, limit: 2, offset: 1 })).data as typeof result;
    assert.deepEqual(second.results, result.results.slice(1, 3));
    const empty = (await executeTool(service, tool, { ...c.input, offset: 1000000 })).data as typeof result;
    assert.deepEqual(empty.results, []); assert.equal(empty.nextOffset, null); assert.equal(empty.hasMore, false);
    for (const [variant, code] of [["http", "upstream_http"], ["parse", "upstream_parse"], ["malformed", "upstream_parse"]]) {
      failure = variant; await assert.rejects(executeTool(service, tool, c.input), { code });
    }
    const before = requests; await assert.rejects(executeTool(service, tool, { ...c.input, limit: 101 })); assert.equal(requests, before);
  }
  failure = ""; const { service, tool } = definition024(profileCase024.tool);
  const profile = (await executeTool(service, tool, profileCase024.input)).data as { grid: string; total: number; returned: number };
  assert.equal(profile.grid, "g_00337"); assert.equal(profile.total, 24); assert.equal(profile.returned, 3);
  console.log(JSON.stringify({ passed: true, variants: cases024.length + 1, realHttpRequests: requests, invalidInputsRejected: cases024.length }));
} finally { globalThis.fetch = actualFetch; setCacheForTesting(null); }
