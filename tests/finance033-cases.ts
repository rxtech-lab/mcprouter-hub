import { readFileSync } from "node:fs";
export function marketsFixture(table: string, lang = "en") {
  return JSON.parse(readFileSync(new URL(`./fixtures/finance033/${table}-${lang}.json`, import.meta.url), "utf8")) as {
    header: { title: string; tablenote: string[]; source: string; status: Record<string, unknown> };
    dataSet: Array<Record<string, string | number>>;
  };
}
export const marketsTables = [
  ["315-38031", "mainland_outward_di_regions", "COUNTRY"],
  ["315-38032", "mainland_outward_di_activities", "ACTIVITY"],
  ["340-45001", "currency_in_circulation", "ISSUER"],
  ["340-45011", "money_supply_all_currencies", ""],
  ["340-45012", "money_supply_currency", "CURRENCY"],
  ["340-45021", "hkd_interest_rates", "DEP_P_T"],
  ["340-45022", "hkd_interest_settlement_rates", "MATURITY"],
  ["340-46001", "exchange_rates", ""],
  ["340-46002", "hkd_effective_exchange_indices", ""],
  ["340-47001", "government_revenue_expenditure", "TYPE_GRA"],
] as const;
export const marketsCases = marketsTables.map(([table, tool, dimension]) => {
  const reply = marketsFixture(table);
  const row = reply.dataSet[0];
  const component = dimension && dimension in row ? String(row[dimension] === "" ? "TOTAL" : row[dimension]) : "NONE";
  const measure = table.startsWith("315-") ? "amount_billion"
    : table === "340-45021" || table === "340-45022" ? "interest_rate"
    : table === "340-46001" ? "exchange_rate" : table === "340-46002" ? "index" : "amount_million";
  const input = { period: String(row.period), freq: String(row.freq), indicator: String(row.sv), component, measure };
  return { table, tool, reply, dimension, input, ttl: 3600,
    request: { url: `https://www.censtatd.gov.hk/api/get.php?id=${table}&full_series=1&lang=en` },
    data: { table, title: reply.header.title, language: "en", componentType: dimension || null, notes: reply.header.tablenote, source: reply.header.source,
      total: 1, returned: 1, hasMore: false, nextOffset: null, results: [{ ...row, component, measure }] } };
});
