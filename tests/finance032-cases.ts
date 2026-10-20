import { readFileSync } from "node:fs";
export function investmentFixture(table: string, lang = "en") {
  return JSON.parse(readFileSync(new URL(`./fixtures/finance032/${table}-${lang}.json`, import.meta.url), "utf8")) as {
    header: { title: string; tablenote: string[]; source: string; status: Record<string, unknown> };
    dataSet: Array<Record<string, string | number>>;
  };
}
export const investmentTables = [
  [
    "315-37006",
    "net_investment_flows_sector",
    "BOP_COMPONENT"
  ],
  [
    "315-37021",
    "international_investment_position",
    "IIP_COMPONENT"
  ],
  [
    "315-37022",
    "iip_gdp_ratios",
    "IIP_COMPONENT"
  ],
  [
    "315-37023",
    "iip_currency_composition",
    "IIP_COMPONENT"
  ],
  [
    "315-37031",
    "external_debt",
    "ED_COMPONENT"
  ],
  [
    "315-38001",
    "direct_investment_statistics",
    "DI_COMPONENT"
  ],
  [
    "315-38011",
    "inward_direct_investment_countries",
    "COUNTRY"
  ],
  [
    "315-38012",
    "inward_direct_investment_activities",
    "ACTIVITY"
  ],
  [
    "315-38021",
    "outward_direct_investment_countries",
    "COUNTRY"
  ],
  [
    "315-38022",
    "outward_direct_investment_activities",
    "ACTIVITY"
  ]
] as const;
export const investmentCases = investmentTables.map(([table, tool, dimension]) => {
  const reply = investmentFixture(table);
  const row = reply.dataSet[0];
  const component = String(row[dimension] || "TOTAL");
  const measure = row.svDesc === "% to GDP" ? "ratio" : "level";
  const input = { period: String(row.period), freq: String(row.freq), indicator: String(row.sv), component, measure,
    ...(table === "315-37023" ? { currency: String(row.CURRENCY || "TOTAL") } : {}) };
  return { table, tool, reply, dimension, input, ttl: 3600,
    request: { url: `https://www.censtatd.gov.hk/api/get.php?id=${table}&full_series=1&lang=en` },
    data: { table, title: reply.header.title, language: "en", componentType: dimension, notes: reply.header.tablenote, source: reply.header.source,
      total: 1, returned: 1, hasMore: false, nextOffset: null, results: [{ ...row, component, measure }] } };
});
