/** Verify full official responses through the generated tools; no cache or writes. */
import assert from "node:assert/strict";
import { service } from "../generated/services/censtatd-national-accounts";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";

setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
let calls = 0;
try {
  for (const tool of service.tools) {
    for (const lang of ["en", "tc", "sc"]) {
      const { data } = await executeTool(service, tool, { lang, limit: 1 });
      const page = data as { table: string; title: string; language: string; total: number; returned: number; results: Array<{ period: string }> };
      assert.equal(page.table, tool.spec.query?.id);
      assert.equal(page.language, lang);
      assert.ok(page.title.length > 0);
      assert.equal(page.returned, 1);
      assert.ok(page.total > 0);
      console.log(JSON.stringify({ tool: tool.name, lang, total: page.total, latest: page.results[0].period }));
      calls++;
    }
  }
  console.log(`Finance 030 live: ${calls}/30 generated-tool calls passed.`);
} finally {
  setCacheForTesting(null);
}
