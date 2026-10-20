/** Run with: bun --conditions=react-server scripts/check-finance033-simulation.ts */
import assert from "node:assert/strict";
import { service as definition } from "../generated/services/censtatd-financial-markets";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";

const baseUrl = process.env.FINANCE033_SIM_URL ?? "http://127.0.0.1:4906/censtatd/api";
assert.match(baseUrl, /^http:\/\/(127\.0\.0\.1|localhost):\d+\/censtatd\/api$/);
const service = { ...definition, baseUrl };
// No cache in this check: every scenario must traverse the real HTTP client.
setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
let calls = 0;
try {
  for (const tool of service.tools) {
    for (const lang of ["en", "tc", "sc"]) {
      const result = await executeTool(service, tool, { lang, limit: 1 });
      assert.equal((result.data as { returned: number }).returned, 1);
      assert.equal((result.data as { language: string }).language, lang);
      calls++;
    }
    for (const [failure, code] of [["http", "upstream_http"], ["json", "upstream_parse"], ["provider", "upstream_parse"]]) {
      const failedTool = { ...tool, spec: { ...tool.spec, headers: { "x-fixture-failure": failure } } };
      await assert.rejects(executeTool(service, failedTool, {}), { code });
      calls++;
    }
    await assert.rejects(executeTool(service, tool, { period: "202513" }));
  }
  console.log(`Finance 033 simulation: ${calls} HTTP calls passed (30 localized successes, 30 upstream failures); 10 invalid-input checks passed.`);
} finally {
  setCacheForTesting(null);
}
