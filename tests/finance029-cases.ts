import { readFileSync } from "node:fs";

export function expenditureFixture(table: string, lang = "en") {
  return JSON.parse(readFileSync(new URL(`./fixtures/finance029/${table}-${lang}.json`, import.meta.url), "utf8")) as {
    header: { title: string; tablenote: string[]; source: string; status: Record<string, unknown> };
    dataSet: Array<Record<string, string | number>>;
  };
}

export const expenditureTables = [
  ["310-31013", "cxdm_groups_current", "level"],
  ["310-31014", "cxdm_groups_chained", "level"],
  ["310-31015", "cxdm_groups_distribution", "distribution"],
  ["310-32021", "gce_components_current", "level"],
  ["310-32022", "gce_components_chained", "level"],
  ["310-32023", "gce_functions_current", "level"],
  ["310-32024", "individual_collective_consumption", "level"],
  ["310-32031", "gdfcf_components_current", "level"],
  ["310-32032", "gdfcf_components_chained", "level"],
  ["310-33041", "services_trade_components_current", "level"],
] as const;

export const expenditureCases = expenditureTables.map(([table, tool, measure]) => {
  const reply = expenditureFixture(table);
  const row = reply.dataSet.find((row) => row.svDesc === (measure === "distribution" ? "%" : "HK$ million"))!;
  const component = String(row.GDP_COMPONENT);
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
