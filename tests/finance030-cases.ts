import { readFileSync } from "node:fs";

export function accountsFixture(table: string, lang = "en") {
  return JSON.parse(readFileSync(new URL(`./fixtures/finance030/${table}-${lang}.json`, import.meta.url), "utf8")) as {
    header: { title: string; tablenote: string[]; source: string; status: Record<string, unknown> };
    dataSet: Array<Record<string, string | number>>;
  };
}

export const accountsTables = [
  ["310-33042", "services_trade_components_chained", "GDP_COMPONENT"],
  ["310-34101", "gdp_activity_current", "ACTIVITY"],
  ["310-34102", "gdp_production_current", null],
  ["310-34201", "activity_output_factor_income", "ACTIVITY"],
  ["310-34401", "production_account", "INS_SECTOR"],
  ["310-34402", "generation_of_income_account", "INS_SECTOR"],
  ["310-34403", "national_accounts_aggregates", null],
  ["310-34501", "gdp_activity_chained", "ACTIVITY"],
  ["310-35091", "real_gross_domestic_income", null],
  ["310-36201", "gni_and_per_capita", null],
] as const;

export const accountsCases = accountsTables.map(([table, tool, dimension]) => {
  const reply = accountsFixture(table);
  const row = reply.dataSet.find((row) => row.svDesc === "HK$ million")!;
  const component = dimension ? String(row[dimension] || "TOTAL") : "TOTAL";
  const measure = "level";
  return {
    table, tool, reply, dimension,
    input: { period: String(row.period), freq: String(row.freq), indicator: String(row.sv), component, measure },
    request: { url: `https://www.censtatd.gov.hk/api/get.php?id=${table}&full_series=1&lang=en` },
    ttl: 3600,
    data: {
      table, title: reply.header.title, language: "en", componentType: dimension,
      notes: reply.header.tablenote, source: reply.header.source,
      total: 1, returned: 1, hasMore: false, nextOffset: null,
      results: [{ ...row, component, measure }],
    },
  };
});
