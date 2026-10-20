import { readFileSync } from "node:fs";

export function gdpFixture(table: string, lang = "en") {
  return JSON.parse(readFileSync(new URL(`./fixtures/finance028/${table}-${lang}.json`, import.meta.url), "utf8")) as {
    header: { title: string; tablenote: string[]; source: string; status: Record<string, unknown> };
    dataSet: Array<Record<string, string | number>>;
  };
}

export const gdpTables = [
  ["310-30001", "gdp_real_growth", "yoy"],
  ["310-31001", "gdp_and_per_capita", "level"],
  ["310-31002", "gdp_expenditure_current", "level"],
  ["310-31003", "gdp_expenditure_chained", "level"],
  ["310-31004", "gdp_growth_contributions", "contribution"],
  ["310-31005", "gdp_implicit_deflators", "level"],
  ["310-31006", "gdp_expenditure_ratios", "ratio"],
  ["310-31007", "gdp_seasonally_adjusted", "level"],
  ["310-31011", "pce_components_current", "level"],
  ["310-31012", "pce_components_chained", "level"],
] as const;

export const financeCases = gdpTables.map(([table, tool, measure]) => {
  const reply = gdpFixture(table);
  const row = reply.dataSet[0];
  const component = row.GDP_COMPONENT || "TOTAL";
  return {
    table, tool, reply,
    input: { period: String(row.period), freq: String(row.freq), indicator: String(row.sv), component, measure },
    request: { url: `https://www.censtatd.gov.hk/api/get.php?id=${table}&full_series=1&lang=en` },
    ttl: 3600,
    data: {
      table, title: reply.header.title, language: "en", notes: reply.header.tablenote, source: reply.header.source,
      total: 1, returned: 1, hasMore: false, nextOffset: null,
      results: [{ ...row, component, measure }],
    },
  };
});
