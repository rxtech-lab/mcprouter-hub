import type { Case } from "./tool-case";
import { contracts } from "@/mcp/services/censtatd-manufacturing-construction/contract";
import { readFileSync } from "node:fs";
export const batch058 = [
  {
    "api": "API-0667",
    "table": "610-72003",
    "tool": "manufacturing_by_value_added"
  },
  {
    "api": "API-0668",
    "table": "610-72004",
    "tool": "manufacturing_by_receipts"
  },
  {
    "api": "API-0669",
    "table": "610-72005",
    "tool": "manufacturing_by_employment"
  },
  {
    "api": "API-0670",
    "table": "610-72006",
    "tool": "manufacturing_detailed_industry"
  },
  {
    "api": "API-0671",
    "table": "610-72013",
    "tool": "manufacturing_related_companies"
  },
  {
    "api": "API-0672",
    "table": "610-92091",
    "tool": "mining_quarry_production"
  },
  {
    "api": "API-0673",
    "table": "615-21001",
    "tool": "construction_labour_2021"
  },
  {
    "api": "API-0674",
    "table": "615-21001A",
    "tool": "construction_labour_2003"
  },
  {
    "api": "API-0675",
    "table": "615-21002",
    "tool": "construction_materials_2021"
  },
  {
    "api": "API-0676",
    "table": "615-21002A",
    "tool": "construction_materials_2003"
  }
] as const;
export function fixture058(table: string, lang = "en") {
  return JSON.parse(readFileSync(new URL(`./fixtures/batch058/${table}-${lang}.json`, import.meta.url), "utf8")) as { header: { title: string; source: string; tablenote: string[]; count: { noOfRecords: number }; status: { code: number; name: string } }; dataSet: Array<Record<string, string | number>> };
}

export const cases058: Case[] = batch058.map((c) => {
  const reply = fixture058(c.table);
  const original = [...reply.dataSet].sort((a, b) => String(b.period).localeCompare(String(a.period)))[0];
  const contract = contracts[c.table];
  const normalized = { ...original, measure: contract.units[String(original.svDesc)],
    ...Object.fromEntries(Object.entries(contract.dimensions).map(([key, v]) => [v.input, original[key] === "" ? "TOTAL" : String(original[key])])) };
  return { tool: c.tool, input: { limit: 1 }, reply, ttl: 3600,
    request: { url: `https://www.censtatd.gov.hk/api/get.php?id=${c.table}&full_series=1&lang=en` },
    data: { table: c.table, title: reply.header.title, source: reply.header.source, notes: reply.header.tablenote,
      language: "en", indexBase: contract.indexBase, total: reply.dataSet.length, returned: 1, results: [normalized], hasMore: true, nextOffset: 1 } };
});
