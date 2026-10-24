import type { Case } from "./tool-case";
import { contracts } from "@/mcp/services/censtatd-business-energy/contract";
import { readFileSync } from "node:fs";
export const batch066 = [
  {
    "api": "API-0758",
    "table": "660-69001",
    "tool": "service_business_receipts_indices"
  },
  {
    "api": "API-0759",
    "table": "660-69002",
    "tool": "service_business_receipts_yoy"
  },
  {
    "api": "API-0760",
    "table": "660-69011",
    "tool": "seasonally_adjusted_business_receipts"
  },
  {
    "api": "API-0761",
    "table": "660-69012",
    "tool": "business_receipts_quarterly_change"
  },
  {
    "api": "API-0762",
    "table": "660-76041",
    "tool": "industry_concentration_ratios"
  },
  {
    "api": "API-0763",
    "table": "660-78001",
    "tool": "enterprise_operating_characteristics"
  },
  {
    "api": "API-0764",
    "table": "660-78001A",
    "tool": "enterprise_operating_characteristics_historical"
  },
  {
    "api": "API-0813",
    "table": "915-91001",
    "tool": "overall_energy_balance"
  },
  {
    "api": "API-0814",
    "table": "915-91101",
    "tool": "energy_net_import_values"
  },
  {
    "api": "API-0815",
    "table": "915-91102",
    "tool": "energy_net_import_quantities"
  }
] as const;
export function fixture066(table: string, lang = "en") {
  return JSON.parse(readFileSync(new URL(`./fixtures/batch066/${table}-${lang}.json`, import.meta.url), "utf8")) as { header: { title: string; source: string; tablenote: string[]; count: { noOfRecords: number }; status: { code: number; name: string } }; dataSet: Array<Record<string, string | number>> };
}

export const cases066: Case[] = batch066.map((c) => {
  const reply = fixture066(c.table);
  const original = [...reply.dataSet].sort((a, b) => String(b.period).localeCompare(String(a.period)))[0];
  const contract = contracts[c.table];
  const normalized = { ...original, measure: contract.units[String(original.svDesc)],
    ...Object.fromEntries(Object.entries(contract.dimensions).map(([key, v]) => [v.input, original[key] === "" ? "TOTAL" : String(original[key])])) };
  return { tool: c.tool, input: { limit: 1 }, reply, ttl: 3600,
    request: { url: `https://www.censtatd.gov.hk/api/get.php?id=${c.table}&full_series=1&lang=en` },
    data: { table: c.table, title: reply.header.title, source: reply.header.source, notes: reply.header.tablenote,
      language: "en", indexReferencePeriod: contract.indexReferencePeriod, seasonallyAdjusted: contract.seasonallyAdjusted, total: reply.dataSet.length, returned: 1, results: [normalized], hasMore: true, nextOffset: 1 } };
});
