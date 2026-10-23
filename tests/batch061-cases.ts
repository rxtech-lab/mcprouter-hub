import type { Case } from "./tool-case";
import { contracts } from "@/mcp/services/censtatd-retail-restaurants/contract";
import { readFileSync } from "node:fs";
export const batch061 = [
  {
    "api": "API-0697",
    "table": "620-67001",
    "tool": "retail_sales_total"
  },
  {
    "api": "API-0698",
    "table": "620-67002",
    "tool": "retail_sales_value_by_outlet"
  },
  {
    "api": "API-0699",
    "table": "620-67003",
    "tool": "retail_sales_volume_by_outlet"
  },
  {
    "api": "API-0700",
    "table": "620-67011",
    "tool": "supermarket_sales_by_product"
  },
  {
    "api": "API-0701",
    "table": "620-67012",
    "tool": "department_store_sales_by_product"
  },
  {
    "api": "API-0702",
    "table": "620-67021",
    "tool": "retail_sales_seasonally_adjusted"
  },
  {
    "api": "API-0703",
    "table": "620-67031",
    "tool": "online_retail_sales"
  },
  {
    "api": "API-0704",
    "table": "620-76011",
    "tool": "supermarket_business_statistics"
  },
  {
    "api": "API-0705",
    "table": "620-76012",
    "tool": "department_store_business_statistics"
  },
  {
    "api": "API-0706",
    "table": "625-68001",
    "tool": "restaurant_receipts_purchases"
  }
] as const;
export function fixture061(table: string, lang = "en") {
  return JSON.parse(readFileSync(new URL(`./fixtures/batch061/${table}-${lang}.json`, import.meta.url), "utf8")) as { header: { title: string; source: string; tablenote: string[]; count: { noOfRecords: number }; status: { code: number; name: string } }; dataSet: Array<Record<string, string | number>> };
}

export const cases061: Case[] = batch061.map((c) => {
  const reply = fixture061(c.table);
  const original = [...reply.dataSet].sort((a, b) => String(b.period).localeCompare(String(a.period)))[0];
  const contract = contracts[c.table];
  const normalized = { ...original, measure: contract.units[String(original.svDesc)],
    ...Object.fromEntries(Object.entries(contract.dimensions).map(([key, v]) => [v.input, original[key] === "" ? "TOTAL" : String(original[key])])) };
  return { tool: c.tool, input: { limit: 1 }, reply, ttl: 3600,
    request: { url: `https://www.censtatd.gov.hk/api/get.php?id=${c.table}&full_series=1&lang=en` },
    data: { table: c.table, title: reply.header.title, source: reply.header.source, notes: reply.header.tablenote,
      language: "en", indexReferencePeriod: contract.indexReferencePeriod, seasonallyAdjusted: contract.seasonallyAdjusted, total: reply.dataSet.length, returned: 1, results: [normalized], hasMore: true, nextOffset: 1 } };
});
