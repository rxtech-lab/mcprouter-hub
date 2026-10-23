import type { Case } from "./tool-case";
import { contracts } from "@/mcp/services/censtatd-construction-output/contract";
import { readFileSync } from "node:fs";
export const batch059 = [
  {
    "api": "API-0677",
    "table": "615-66001",
    "tool": "construction_output"
  },
  {
    "api": "API-0678",
    "table": "615-66002",
    "tool": "construction_output_seasonally_adjusted"
  },
  {
    "api": "API-0679",
    "table": "615-66011",
    "tool": "construction_nominal_by_trade"
  },
  {
    "api": "API-0680",
    "table": "615-66012",
    "tool": "construction_real_by_trade"
  },
  {
    "api": "API-0681",
    "table": "615-66021",
    "tool": "construction_nominal_broad_end_use"
  },
  {
    "api": "API-0682",
    "table": "615-66022",
    "tool": "construction_real_broad_end_use"
  },
  {
    "api": "API-0683",
    "table": "615-66023",
    "tool": "construction_nominal_detailed_end_use"
  },
  {
    "api": "API-0684",
    "table": "615-66024",
    "tool": "construction_real_detailed_end_use"
  },
  {
    "api": "API-0685",
    "table": "615-66031",
    "tool": "construction_nominal_by_activity"
  },
  {
    "api": "API-0686",
    "table": "615-73001",
    "tool": "construction_industry_statistics"
  }
] as const;
export function fixture059(table: string, lang = "en") {
  return JSON.parse(readFileSync(new URL(`./fixtures/batch059/${table}-${lang}.json`, import.meta.url), "utf8")) as { header: { title: string; source: string; tablenote: string[]; count: { noOfRecords: number }; status: { code: number; name: string } }; dataSet: Array<Record<string, string | number>> };
}

export const cases059: Case[] = batch059.map((c) => {
  const reply = fixture059(c.table);
  const original = [...reply.dataSet].sort((a, b) => String(b.period).localeCompare(String(a.period)))[0];
  const contract = contracts[c.table];
  const normalized = { ...original, measure: contract.units[String(original.svDesc)],
    ...Object.fromEntries(Object.entries(contract.dimensions).map(([key, v]) => [v.input, original[key] === "" ? "TOTAL" : String(original[key])])) };
  return { tool: c.tool, input: { limit: 1 }, reply, ttl: 3600,
    request: { url: `https://www.censtatd.gov.hk/api/get.php?id=${c.table}&full_series=1&lang=en` },
    data: { table: c.table, title: reply.header.title, source: reply.header.source, notes: reply.header.tablenote,
      language: "en", realTermsBaseYear: contract.realTermsBaseYear, seasonallyAdjusted: contract.seasonallyAdjusted, total: reply.dataSet.length, returned: 1, results: [normalized], hasMore: true, nextOffset: 1 } };
});
