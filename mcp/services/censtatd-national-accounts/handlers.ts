import { UpstreamError } from "@/lib/mcp/fetcher";
import type { ResponseTransformer } from "@/lib/mcp/types";

const dimensions: Record<string, string | null> = {
  "310-33042": "GDP_COMPONENT", "310-34101": "ACTIVITY", "310-34102": null,
  "310-34201": "ACTIVITY", "310-34401": "INS_SECTOR", "310-34402": "INS_SECTOR",
  "310-34403": null, "310-34501": "ACTIVITY", "310-35091": null, "310-36201": null,
};
const units: Record<string, string> = {
  "HK$ million": "level", "百萬港元": "level", "百万港元": "level",
  "HK$": "level", "港元": "level",
  "Year-on-year % change": "yoy", "按年變動百分率": "yoy", "按年变动百分率": "yoy",
  "% contribution to GDP": "share", "佔本地生產總值的百分比": "share", "占本地生产总值的百分比": "share",
  "(%)": "ratio",
};
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function malformed(detail: string): never {
  throw new UpstreamError("upstream_parse", `C&SD national accounts response ${detail}. Retry later or check the official web table.`);
}

/** Preserve source dimensions, monetary units, missing values and revision flags. */
export const normalizeNationalAccounts: ResponseTransformer = (body, input, context) => {
  const table = String(context.tool.spec.query?.id);
  if (!(table in dimensions)) return malformed("has an unsupported table ID");
  const dimension = dimensions[table];
  if (!record(body) || !record(body.header)) return malformed("is missing its header");
  const header = body.header;
  if (!record(header.status) || header.status.code !== 0 || header.status.name !== "Success") {
    return malformed("reported a failed or missing query status");
  }
  if (typeof header.title !== "string" || !Array.isArray(body.dataSet)) return malformed("is missing its title or dataSet array");
  const rows = body.dataSet.map((row): Record<string, unknown> => {
    if (!record(row) || !["Y", "Q"].includes(String(row.freq)) ||
      typeof row.period !== "string" || !/^\d{4}(03|06|09|12)?$/.test(row.period) ||
      (row.freq === "Y" ? row.period.length !== 4 : row.period.length !== 6) ||
      !context.tool.spec.input.freq.enum?.includes(String(row.freq)) ||
      typeof row.sv !== "string" || typeof row.svDesc !== "string" || !units[row.svDesc] ||
      !context.tool.spec.input.indicator.enum?.includes(row.sv) ||
      !(typeof row.figure === "string" || (typeof row.figure === "number" && Number.isFinite(row.figure))) ||
      typeof row.sd_value !== "string" ||
      (dimension && (typeof row[dimension] !== "string" || typeof row[`${dimension}Desc`] !== "string"))) {
      return malformed("contains a malformed observation or unsupported unit/indicator");
    }
    const component = dimension ? row[dimension] || "TOTAL" : "TOTAL";
    if (!context.tool.spec.input.component.enum?.includes(String(component))) return malformed("contains an unsupported component");
    const measure = units[row.svDesc];
    if (!context.tool.spec.input.measure.enum?.includes(measure)) return malformed("contains an unsupported measure");
    return { ...row, component, measure };
  });
  const filtered = rows.filter((row) =>
    (!input.period || String(row.period).startsWith(String(input.period))) &&
    (!input.freq || row.freq === input.freq) &&
    (!input.indicator || row.sv === input.indicator) &&
    (!input.component || row.component === input.component) &&
    (!input.measure || row.measure === input.measure),
  ).sort((a, b) => String(b.period).localeCompare(String(a.period)));
  const offset = Number(input.offset ?? 0);
  const results = filtered.slice(offset, offset + Number(input.limit ?? 50));
  const hasMore = offset + results.length < filtered.length;
  return {
    table, title: header.title, language: input.lang ?? "en", componentType: dimension,
    notes: header.tablenote ?? [], source: header.source,
    total: filtered.length, returned: results.length, hasMore,
    nextOffset: hasMore ? offset + results.length : null, results,
  };
};
