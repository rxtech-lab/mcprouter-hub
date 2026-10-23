import { readFileSync } from "node:fs";
import { contracts } from "@/mcp/services/censtatd-business-surveys/contract";

export const batch053 = [
  ["330-40001", "sme_diffusion_indices"], ["330-40002", "sme_credit_needs"],
  ["330-41001", "business_expected_situation"], ["330-41002", "business_expected_output"],
  ["330-41003", "business_expected_employment"], ["330-41004", "business_expected_prices"],
  ["330-41011", "business_orders_stocks_levels"], ["330-41021", "business_profit_situation"],
  ["330-41022", "business_financial_situation"], ["330-41023", "business_credit_access"],
] as const;
export function fixture053(table: string, lang = "en") {
  return JSON.parse(readFileSync(new URL(`./fixtures/batch053/${table}-${lang}.json`, import.meta.url), "utf8")) as {
    header: { title: string; source: string; tablenote: string[]; status: Record<string, unknown> };
    dataSet: Array<Record<string, string | number>>;
  };
}
export const cases053 = batch053.map(([table, tool]) => {
  const reply = fixture053(table);
  const row = reply.dataSet.at(-1)!;
  const contract = contracts[table];
  const dimensions = Object.fromEntries(Object.entries(contract.dimensions).map(([key, dim]) => [dim.input, String(row[key]) || "TOTAL"]));
  return { tool, table, reply, ttl: 3600, input: { period: String(row.period), indicator: row.sv, ...dimensions },
    request: { url: `https://www.censtatd.gov.hk/api/get.php?id=${table}&full_series=1&lang=en` },
    data: { table, title: reply.header.title, source: reply.header.source, notes: reply.header.tablenote, language: "en",
      frequency: contract.freq, total: 1, returned: 1, hasMore: false, nextOffset: null,
      results: [{ ...row, measure: contract.units[row.svDesc], ...dimensions }] },
  };
});
