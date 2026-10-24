import type { Case } from "./tool-case";
import { contracts } from "@/mcp/services/censtatd-restaurants-industry/contract";
import { readFileSync } from "node:fs";
export const batch062 = [
  {
    "api": "API-0707",
    "table": "625-68002",
    "tool": "restaurant_receipts_purchases_monthly"
  },
  {
    "api": "API-0708",
    "table": "625-68003",
    "tool": "restaurant_receipts_by_type"
  },
  {
    "api": "API-0709",
    "table": "625-68004",
    "tool": "restaurant_receipts_by_type_monthly"
  },
  {
    "api": "API-0710",
    "table": "625-68011",
    "tool": "restaurant_receipts_seasonally_adjusted"
  },
  {
    "api": "API-0711",
    "table": "625-76101",
    "tool": "accommodation_food_business_statistics"
  },
  {
    "api": "API-0712",
    "table": "625-76102",
    "tool": "accommodation_food_statistics_by_employment"
  },
  {
    "api": "API-0713",
    "table": "625-76103",
    "tool": "accommodation_food_statistics_by_receipts"
  },
  {
    "api": "API-0714",
    "table": "625-76104",
    "tool": "accommodation_food_statistics_by_value_added"
  },
  {
    "api": "API-0715",
    "table": "630-76001",
    "tool": "trades_business_statistics"
  },
  {
    "api": "API-0716",
    "table": "630-76002",
    "tool": "trades_statistics_by_employment"
  }
] as const;
export function fixture062(table: string, lang = "en") {
  return JSON.parse(readFileSync(new URL(`./fixtures/batch062/${table}-${lang}.json`, import.meta.url), "utf8")) as { header: { title: string; source: string; tablenote: string[]; count: { noOfRecords: number }; status: { code: number; name: string } }; dataSet: Array<Record<string, string | number>> };
}

export const cases062: Case[] = batch062.map((c) => {
  const reply = fixture062(c.table);
  const original = [...reply.dataSet].sort((a, b) => String(b.period).localeCompare(String(a.period)))[0];
  const contract = contracts[c.table];
  const normalized = { ...original, measure: contract.units[String(original.svDesc)],
    ...Object.fromEntries(Object.entries(contract.dimensions).map(([key, v]) => [v.input, original[key] === "" ? "TOTAL" : String(original[key])])) };
  return { tool: c.tool, input: { limit: 1 }, reply, ttl: 3600,
    request: { url: `https://www.censtatd.gov.hk/api/get.php?id=${c.table}&full_series=1&lang=en` },
    data: { table: c.table, title: reply.header.title, source: reply.header.source, notes: reply.header.tablenote,
      language: "en", indexReferencePeriod: contract.indexReferencePeriod, seasonallyAdjusted: contract.seasonallyAdjusted, total: reply.dataSet.length, returned: 1, results: [normalized], hasMore: true, nextOffset: 1 } };
});
