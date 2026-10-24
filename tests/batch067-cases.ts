import type { Case } from "./tool-case";
import { contracts } from "@/mcp/services/censtatd-energy/contract";
import { readFileSync } from "node:fs";
export const batch067 = [
  {
    "api": "API-0816",
    "table": "915-91103",
    "tool": "energy_import_unit_values"
  },
  {
    "api": "API-0817",
    "table": "915-91104",
    "tool": "monthly_energy_net_imports"
  },
  {
    "api": "API-0818",
    "table": "915-91105",
    "tool": "oil_storage_and_stocks"
  },
  {
    "api": "API-0819",
    "table": "915-91106",
    "tool": "oil_sales_by_user"
  },
  {
    "api": "API-0820",
    "table": "915-91107",
    "tool": "oil_imports_by_supplier"
  },
  {
    "api": "API-0821",
    "table": "915-91108",
    "tool": "coal_imports_by_supplier"
  },
  {
    "api": "API-0822",
    "table": "915-91109",
    "tool": "oil_reexports_by_destination"
  },
  {
    "api": "API-0823",
    "table": "915-91110",
    "tool": "coal_reexports_by_destination"
  },
  {
    "api": "API-0824",
    "table": "915-91201",
    "tool": "monthly_electricity_gas_consumption"
  },
  {
    "api": "API-0825",
    "table": "915-91202",
    "tool": "electricity_gas_consumption_revenue"
  }
] as const;
export function fixture067(table: string, lang = "en") {
  return JSON.parse(readFileSync(new URL(`./fixtures/batch067/${table}-${lang}.json`, import.meta.url), "utf8")) as { header: { title: string; source: string; tablenote: string[]; count: { noOfRecords: number }; status: { code: number; name: string } }; dataSet: Array<Record<string, string | number>> };
}

export const cases067: Case[] = batch067.map((c) => {
  const reply = fixture067(c.table);
  const original = [...reply.dataSet].sort((a, b) => String(b.period).localeCompare(String(a.period)))[0];
  const contract = contracts[c.table];
  const normalized = { ...original, measure: contract.units[String(original.svDesc)],
    ...Object.fromEntries(Object.entries(contract.dimensions).map(([key, v]) => [v.input, original[key] === undefined ? null : original[key] === "" ? "TOTAL" : String(original[key])])) };
  return { tool: c.tool, input: { limit: 1 }, reply, ttl: 3600,
    request: { url: `https://www.censtatd.gov.hk/api/get.php?id=${c.table}&full_series=1&lang=en` },
    data: { table: c.table, title: reply.header.title, source: reply.header.source, notes: reply.header.tablenote,
      language: "en", indexReferencePeriod: contract.indexReferencePeriod, seasonallyAdjusted: contract.seasonallyAdjusted, total: reply.dataSet.length, returned: 1, results: [normalized], hasMore: true, nextOffset: 1 } };
});
