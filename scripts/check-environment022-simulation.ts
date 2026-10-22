/** Generated executors over real loopback HTTP served by Postman, using captured provider fixtures. */
import assert from "node:assert/strict";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";
import { cases022, definition022 } from "../tests/environment022-cases";
const root = process.env.ENVIRONMENT022_SIM_URL ?? "http://127.0.0.1:4922/upstream";
assert.match(root, /^http:\/\/(127\.0\.0\.1|localhost):\d+\/upstream$/);
const actualFetch = globalThis.fetch;
let failure = "";
let requests = 0;
globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input)); assert.equal(url.hostname, "portal.csdi.gov.hk"); requests++;
  return actualFetch(`${root}${url.pathname}${url.search}`, { ...init, headers: { ...init?.headers, "x-fixture-failure": failure } });
}) as typeof fetch;
setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
try {
  for (const c of cases022) {
    const { service, tool } = definition022(c.tool);
    failure = "";
    const result = (await executeTool(service, tool, c.input)).data as { results: unknown[]; returned: number; hasMore: boolean; nextOffset: number | null };
    assert.equal(result.returned, c.reply.features.length); assert.deepEqual(result.results, c.data.results);
    const second = (await executeTool(service, tool, { ...c.input, limit: 1, offset: 1 })).data as typeof result;
    assert.deepEqual(second.results, result.results.slice(1, 2));
    const empty = (await executeTool(service, tool, { ...c.input, offset: 100 })).data as typeof result;
    assert.deepEqual(empty.results, []); assert.equal(empty.hasMore, false); assert.equal(empty.nextOffset, null);
    for (const [variant, code] of [["http", "upstream_http"], ["parse", "upstream_parse"], ["provider", "upstream_http"], ["feature", "upstream_parse"]]) {
      failure = variant; await assert.rejects(executeTool(service, tool, c.input), { code });
    }
    const before = requests;
    await assert.rejects(executeTool(service, tool, { ...c.input, limit: 101 })); assert.equal(requests, before);
  }
  console.log(JSON.stringify({ passed: true, variants: cases022.length, realHttpRequests: requests, invalidInputsRejected: cases022.length }));
} finally { globalThis.fetch = actualFetch; setCacheForTesting(null); }
