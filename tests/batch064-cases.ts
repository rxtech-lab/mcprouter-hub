import type { Case } from "./tool-case";
import { contracts } from "@/mcp/services/censtatd-business-performance/contract";
import { readFileSync } from "node:fs";
export const batch064 = [
  {
    "api": "API-0730",
    "table": "640-75103",
    "tool": "information_communications_by_receipts"
  },
  {
    "api": "API-0731",
    "table": "640-75104",
    "tool": "information_communications_by_value_added"
  },
  {
    "api": "API-0733",
    "table": "645-75001",
    "tool": "financial_professional_business_statistics"
  },
  {
    "api": "API-0734",
    "table": "645-75002",
    "tool": "professional_business_by_employment"
  },
  {
    "api": "API-0735",
    "table": "645-75003",
    "tool": "professional_business_by_receipts"
  },
  {
    "api": "API-0736",
    "table": "645-75004",
    "tool": "professional_business_by_value_added"
  },
  {
    "api": "API-0737",
    "table": "645-75011",
    "tool": "banking_statistics_by_employment"
  },
  {
    "api": "API-0738",
    "table": "645-75012",
    "tool": "domestic_banking_by_receipts"
  },
  {
    "api": "API-0739",
    "table": "645-75013",
    "tool": "domestic_banking_detailed_statistics"
  },
  {
    "api": "API-0740",
    "table": "645-75020",
    "tool": "insurance_detailed_statistics"
  }
] as const;
export function fixture064(table: string, lang = "en") {
  return JSON.parse(readFileSync(new URL(`./fixtures/batch064/${table}-${lang}.json`, import.meta.url), "utf8")) as { header: { title: string; source: string; tablenote: string[]; count: { noOfRecords: number }; status: { code: number; name: string } }; dataSet: Array<Record<string, string | number>> };
}

export const cases064: Case[] = batch064.map((c) => {
  const reply = fixture064(c.table);
  const original = [...reply.dataSet].sort((a, b) => String(b.period).localeCompare(String(a.period)))[0];
  const contract = contracts[c.table];
  const normalized = { ...original, measure: contract.units[String(original.svDesc)],
    ...Object.fromEntries(Object.entries(contract.dimensions).map(([key, v]) => [v.input, original[key] === "" ? "TOTAL" : String(original[key])])) };
  return { tool: c.tool, input: { limit: 1 }, reply, ttl: 3600,
    request: { url: `https://www.censtatd.gov.hk/api/get.php?id=${c.table}&full_series=1&lang=en` },
    data: { table: c.table, title: reply.header.title, source: reply.header.source, notes: reply.header.tablenote,
      language: "en", indexReferencePeriod: contract.indexReferencePeriod, seasonallyAdjusted: contract.seasonallyAdjusted, total: reply.dataSet.length, returned: 1, results: [normalized], hasMore: true, nextOffset: 1 } };
});
