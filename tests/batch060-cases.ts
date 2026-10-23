import type { Case } from "./tool-case";
import { contracts } from "@/mcp/services/censtatd-building-business/contract";
import { readFileSync } from "node:fs";
export const batch060 = [
  {
    "api": "API-0687",
    "table": "615-73002",
    "tool": "architecture_selected_statistics"
  },
  {
    "api": "API-0688",
    "table": "615-73003",
    "tool": "real_estate_selected_statistics"
  },
  {
    "api": "API-0689",
    "table": "615-73011",
    "tool": "construction_business_by_industry"
  },
  {
    "api": "API-0690",
    "table": "615-73012",
    "tool": "construction_business_by_output"
  },
  {
    "api": "API-0691",
    "table": "615-73013",
    "tool": "construction_business_by_value_added"
  },
  {
    "api": "API-0692",
    "table": "615-73021",
    "tool": "main_contractors_business_statistics"
  },
  {
    "api": "API-0693",
    "table": "615-73031",
    "tool": "real_estate_business_by_industry"
  },
  {
    "api": "API-0694",
    "table": "615-73032",
    "tool": "real_estate_business_by_receipts"
  },
  {
    "api": "API-0695",
    "table": "615-73051",
    "tool": "architecture_principal_statistics"
  },
  {
    "api": "API-0696",
    "table": "615-73052",
    "tool": "architecture_business_by_receipts"
  }
] as const;
export function fixture060(table: string, lang = "en") {
  return JSON.parse(readFileSync(new URL(`./fixtures/batch060/${table}-${lang}.json`, import.meta.url), "utf8")) as { header: { title: string; source: string; tablenote: string[]; count: { noOfRecords: number }; status: { code: number; name: string } }; dataSet: Array<Record<string, string | number>> };
}

export const cases060: Case[] = batch060.map((c) => {
  const reply = fixture060(c.table);
  const original = [...reply.dataSet].sort((a, b) => String(b.period).localeCompare(String(a.period)))[0];
  const contract = contracts[c.table];
  const normalized = { ...original, measure: contract.units[String(original.svDesc)],
    ...Object.fromEntries(Object.entries(contract.dimensions).map(([key, v]) => [v.input, original[key] === "" ? "TOTAL" : String(original[key])])) };
  return { tool: c.tool, input: { limit: 1 }, reply, ttl: 3600,
    request: { url: `https://www.censtatd.gov.hk/api/get.php?id=${c.table}&full_series=1&lang=en` },
    data: { table: c.table, title: reply.header.title, source: reply.header.source, notes: reply.header.tablenote,
      language: "en", realTermsBaseYear: contract.realTermsBaseYear, seasonallyAdjusted: contract.seasonallyAdjusted, total: reply.dataSet.length, returned: 1, results: [normalized], hasMore: true, nextOffset: 1 } };
});
