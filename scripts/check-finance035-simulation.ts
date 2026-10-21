/** Exercise generated tools over real loopback HTTP served by Postman. */
import assert from "node:assert/strict";
import { services } from "../generated/registry";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";

const root = process.env.FINANCE035_SIM_URL ?? "http://127.0.0.1:4905/finance";
assert.match(root, /^http:\/\/(127\.0\.0\.1|localhost):\d+\/finance$/);
const names = ["cr_company_addresses", "cr_tcsp_licensees", "customs_bonded_warehouses", "hkma_exchange_rates", "hkma_hibor", "hkma_interbank_liquidity", "hkma_securities_staff", "hkma_money_brokers", "hkma_cmu_instruments", "hkma_cmu_members"];
setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
let calls = 0;
let invalid = 0;
try {
  for (const name of names) {
    const definition = services.find((s) => s.tools.some((t) => t.name === name))!;
    const service = { ...definition, baseUrl: root + new URL(definition.baseUrl!).pathname.replace(/\/$/, "") };
    const tool = service.tools.find((t) => t.name === name)!;
    const input = name === "cr_company_addresses" ? { value: "C1572528" } : name === "hkma_securities_staff" ? { search: "EXAMPLE" } : {};
    const variants = name === "cr_company_addresses" ? [{ ...input }, { register: "foreign", value: "75698252" }] :
      tool.spec.input.lang ? (tool.spec.input.lang.enum as string[]).map((lang) => ({ ...input, lang })) : [input];
    for (const variant of variants) {
      const result = (await executeTool(service, tool, { ...variant, limit: 3 })).data as { returned: number; results: unknown[] };
      assert.ok(result.returned > 0 && result.returned <= 3, name);
      assert.equal(result.returned, result.results.length);
      calls++;
    }
    for (const [failure, code] of [["blocked", "upstream_http"], ["http", "upstream_http"], ["parse", "upstream_parse"], ["provider", "upstream_parse"], ["malformed", "upstream_parse"]]) {
      const failed = { ...tool, spec: { ...tool.spec, headers: { "x-fixture-failure": failure } } };
      await assert.rejects(executeTool(service, failed, input), { code, ...(failure === "blocked" ? { status: 405 } : {}) });
      calls++;
    }
    await assert.rejects(executeTool(service, tool, { ...input, limit: 101 }));
    invalid++;
  }
  console.log(`Finance 035 simulation: ${calls} real HTTP requests passed (17 successes, 50 expected failures including ten HTTP 405 block pages); ${invalid} invalid inputs rejected before HTTP.`);
} finally { setCacheForTesting(null); }
