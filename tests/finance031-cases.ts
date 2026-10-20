import { readFileSync } from "node:fs";
export function externalFixture(table: string, lang = "en") {
 return JSON.parse(readFileSync(new URL(`./fixtures/finance031/${table}-${lang}.json`, import.meta.url), "utf8")) as {
 header: { title: string; tablenote: string[]; source: string; status: Record<string, unknown> };
 dataSet: Array<Record<string, string | number>>;
 };
}
export const externalTables = [
  [
    "310-36202",
    "epif_income_components",
    "INC_CPNT"
  ],
  [
    "310-36203",
    "epif_countries",
    "COUNTRY"
  ],
  [
    "310-36204",
    "epif_real",
    null
  ],
  [
    "310-36205",
    "gross_national_disposable_income",
    null
  ],
  [
    "310-37011",
    "rest_of_world_account",
    "RWA_COMPONENT"
  ],
  [
    "315-37001",
    "balance_of_payments",
    "BOP_COMPONENT"
  ],
  [
    "315-37002",
    "bop_gdp_ratios",
    "BOP_COMPONENT"
  ],
  [
    "315-37003",
    "bop_current_capital_account",
    "BOP_COMPONENT"
  ],
  [
    "315-37004",
    "bop_financial_account",
    "BOP_COMPONENT"
  ],
  [
    "315-37005",
    "current_account_seasonal_changes",
    "BOP_COMPONENT"
  ]
] as const;
export const externalCases = externalTables.map(([table, tool, dimension]) => {
 const reply = externalFixture(table); const row = reply.dataSet[0];
 const component = dimension ? String(row[dimension] || "TOTAL") : "TOTAL";
 const measure = table === "315-37002" ? "ratio" : table === "315-37005" ? "qoq" : "level";
 const input = { period: String(row.period), freq: String(row.freq), indicator: String(row.sv), component, measure, ...(row.FLOWS ? { flow: String(row.FLOWS) } : {}) };
 return { table, tool, reply, dimension, input, ttl: 3600,
 request: { url: `https://www.censtatd.gov.hk/api/get.php?id=${table}&full_series=1&lang=en` },
 data: { table, title: reply.header.title, language: "en", componentType: dimension, notes: reply.header.tablenote, source: reply.header.source,
 total: 1, returned: 1, hasMore: false, nextOffset: null, results: [{ ...row, component, measure }] } };
});
