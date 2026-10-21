/** Availability audit through generated tools; failures do not falsely register tracker IDs. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { services } from "../generated/registry";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";

const names = ["cr_company_addresses", "cr_tcsp_licensees", "customs_bonded_warehouses", "hkma_hibor"];
setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
let passed = 0;
let failed = 0;
let skipped = 0;
const startedAt = new Date().toISOString();
type LivePage = { returned: number; results: Record<string, unknown>[]; total?: number; nextOffset: number | null };
const evidence: Record<string, unknown>[] = [];
function report(event: Record<string, unknown>) {
  const entry = { checkedAt: new Date().toISOString(), ...event };
  evidence.push(entry);
  console.log(JSON.stringify(entry));
}
try {
  await Promise.all(names.map(async (name) => {
    const service = services.find((s) => s.tools.some((t) => t.name === name))!;
    const tool = service.tools.find((t) => t.name === name)!;
    const variants = name === "cr_company_addresses" ? [{ register: "local", value: "C1572528" }, { register: "foreign", value: "75698252" }] :
      tool.spec.input.lang ? (tool.spec.input.lang.enum as string[]).map((lang) => ({ lang })) : [{}];
    for (const variant of variants) {
      let first: LivePage;
      try {
        const { data, meta } = await executeTool(service, tool, { ...variant, limit: 3 });
        const result = data as LivePage;
        assert.ok(result.returned > 0 && result.returned <= 3);
        assert.equal(result.returned, result.results.length);
        report({ tool: name, check: "initial", variant, status: "passed", source: meta.source, returned: result.returned, total: result.total,
          fields: Object.keys(result.results[0]).sort() });
        first = result;
        passed++;
      } catch (error) {
        const err = error as Error & { code?: string; status?: number };
        // Never save HTML block pages, upstream bodies or staff records as evidence.
        report({ tool: name, check: "initial", variant, status: "failed", code: err.code, httpStatus: err.status,
          message: err.status ? `Official upstream returned HTTP ${err.status}` : err.message.slice(0, 140) });
        failed++;
        if (service.id === "hkma-finance") {
          report({ tool: name, variant, check: "contract-followups", status: "skipped", reason: "Initial official request failed; no live row available to validate paging, date or search contracts." });
          skipped++;
        }
        continue;
      }
      if (service.id !== "hkma-finance") continue;
      const checks: { name: string; input: Record<string, unknown>; validate: (page: LivePage) => void }[] = [];
      // Compare adjacent small pages with one larger page; a repeated first page must fail.
      if (first.nextOffset !== null) checks.push({ name: "pagination", input: { ...variant, limit: 3, offset: first.nextOffset }, validate: () => {} });
      const dateField = "end_of_day";
      if (dateField) {
        const date = String(first.results[0][dateField]);
        checks.push({ name: "inclusive-date-range", input: { ...variant, limit: 3, from: date, to: date }, validate: (page) => {
          assert.ok(page.returned > 0, "A known live date must be returned");
          assert.ok(page.results.every((row) => row[dateField] === date), "Rows must respect both inclusive date bounds");
        } });
      }
      for (const check of checks) {
        try {
          const { data, meta } = await executeTool(service, tool, check.input);
          const page = data as LivePage;
          assert.equal(page.returned, page.results.length);
          assert.ok(page.returned <= 3);
          check.validate(page);
          if (check.name === "pagination") {
            const combined = (await executeTool(service, tool, { ...variant, limit: 6 })).data as LivePage;
            assert.deepEqual([...first.results, ...page.results], combined.results, "Offset pages must match the combined live page");
            // Identical adjacent nonempty pages indicate an ignored offset even if limit is also ignored.
            if (page.returned) assert.notDeepEqual(first.results, page.results, "Offset must advance the register");
          }
          report({ tool: name, variant, check: check.name, status: "passed", source: meta.source, returned: page.returned });
          passed++;
        } catch (error) {
          const err = error as Error & { code?: string; status?: number };
          report({ tool: name, variant, check: check.name, status: "failed", code: err.code, httpStatus: err.status,
            message: err.status ? `Official upstream returned HTTP ${err.status}` : err.message.split("\n")[0].slice(0, 140) });
          failed++;
        }
      }
    }
  }));
  const summary = { startedAt, finishedAt: new Date().toISOString(), passed, failed, skipped, retainedToolsPassed: failed === 0 && skipped === 0, complete: false, incompleteApis: ["API-0046", "API-0048", "API-2153", "API-2154", "API-2158", "API-2159"] };
  console.log(JSON.stringify(summary));
  if (process.env.FINANCE035_LIVE_REPORT) writeFileSync(process.env.FINANCE035_LIVE_REPORT, JSON.stringify({ ...summary, evidence }, null, 2) + "\n");
  if (!summary.complete) process.exitCode = 1;
} finally { setCacheForTesting(null); }
