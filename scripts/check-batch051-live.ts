/** Read-only live verification of the retained Batch051 tools. No retries. */
import assert from "node:assert/strict";
import { services } from "../generated/registry";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";

const names = ["hktr_interest_rate_positions", "hktr_members_lei", "ird_offices", "hk_address_lookup", "lcsd_swimming_pools", "hk_government_press_releases", "regional_office_counts", "regional_office_employment", "regional_offices_parent_location"];
setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
let passed = 0;
let failed = 0;
try {
  for (const name of names) {
    const service = services.find((s) => s.tools.some((t) => t.name === name))!;
    const tool = service.tools.find((t) => t.name === name)!;
    const languages = tool.spec.input.lang?.enum ?? ["en"];
    for (const lang of languages) {
      try {
        const input = { ...(tool.spec.input.lang ? { lang } : {}), ...(name === "hk_address_lookup" ? { q: "central government offices" } : {}), limit: 3 };
        const result = await executeTool(service, tool, input);
        const data = result.data as { returned: number; results: unknown[]; nextOffset: number | null };
        assert.ok(data.returned > 0 && data.returned <= 3);
        assert.equal(data.returned, data.results.length);
        console.log(JSON.stringify({ tool: name, lang, outcome: "success", returned: data.returned, nextOffset: data.nextOffset, source: result.meta.source }));
        passed++;
      } catch (error) {
        console.log(JSON.stringify({ tool: name, lang, outcome: "failed", error: String(error) }));
        failed++;
        break; // Do not retry an API after a genuine failure.
      }
    }
  }
  console.log(JSON.stringify({ passed, failed }));
  if (failed) process.exitCode = 1;
} finally { setCacheForTesting(null); }
