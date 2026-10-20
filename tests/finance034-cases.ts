import { readFileSync } from "node:fs";
import { contracts } from "@/mcp/services/censtatd-government-markets/contract";
export function governmentFixture(table: string, lang = "en") {
  return JSON.parse(readFileSync(new URL(`./fixtures/finance034/${table}-${lang}.json`, import.meta.url), "utf8")) as {
    header: { title: string; tablenote: string[]; source: string; status: Record<string, unknown> };
    dataSet: Array<Record<string, string | number>>;
  };
}
export const governmentTables = [
  [
    "340-47002",
    "government_quarterly_revenue_expenditure",
    "TYPE_GRA"
  ],
  [
    "340-47011",
    "government_revenue_funds",
    "REV_TYPE"
  ],
  [
    "340-47012",
    "government_expenditure_funds",
    "EXP_TYPE"
  ],
  [
    "340-92002",
    "silver_trading_prices",
    ""
  ],
  [
    "340-95001",
    "interbank_market",
    ""
  ],
  [
    "340-95002",
    "exchange_fund_bills_notes_turnover",
    ""
  ],
  [
    "340-95003",
    "hkex_securities_statistics",
    "SECURITIES_MARKET"
  ],
  [
    "340-95004",
    "hkex_derivatives_volume",
    ""
  ],
  [
    "340-95005",
    "stock_connect_trading_values",
    ""
  ],
  [
    "340-95006",
    "gold_exchange_turnover",
    ""
  ]
] as const;
export const governmentCases = governmentTables.map(([table, tool, dimension]) => {
  const reply = governmentFixture(table);
  const row = reply.dataSet[0];
  const component = dimension ? String(row[dimension] === "" ? "TOTAL" : row[dimension]) : "NONE";
  const unitMap: Record<string, string> = contracts[table].units;
  const measure = unitMap[String(row.svDesc)];
  const input = { period: String(row.period), freq: String(row.freq), indicator: String(row.sv), component, measure };
  return { table, tool, reply, dimension, input, ttl: 3600,
    request: { url: `https://www.censtatd.gov.hk/api/get.php?id=${table}&full_series=1&lang=en` },
    data: { table, title: reply.header.title, language: "en", componentType: dimension || null, notes: reply.header.tablenote, source: reply.header.source,
      total: 1, returned: 1, hasMore: false, nextOffset: null, results: [{ ...row, component, measure }] } };
});
