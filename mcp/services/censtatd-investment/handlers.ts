import { UpstreamError } from "@/lib/mcp/fetcher";
import type { ResponseTransformer } from "@/lib/mcp/types";

const dimensions: Record<string, string> = {
  "315-37006": "BOP_COMPONENT",
  "315-37021": "IIP_COMPONENT",
  "315-37022": "IIP_COMPONENT",
  "315-37023": "IIP_COMPONENT",
  "315-37031": "ED_COMPONENT",
  "315-38001": "DI_COMPONENT",
  "315-38011": "COUNTRY",
  "315-38012": "ACTIVITY",
  "315-38021": "COUNTRY",
  "315-38022": "ACTIVITY",
};
const units: Record<string, string> = {
  "HK$ million": "level", "百萬港元": "level", "百万港元": "level",
  "HK$ billion": "level", "十億港元": "level", "十亿港元": "level",
  "% to GDP": "ratio", "相對本地生產總值的百分比": "ratio", "相对本地生产总值的百分比": "ratio",
};
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function malformed(detail: string): never {
  throw new UpstreamError("upstream_parse", `C&SD investment response ${detail}. Retry later or check the official web table.`);
}

/** Preserve source dimensions, monetary units, missing values and revision flags. */
export const normalizeInvestment: ResponseTransformer = (body, input, context) => {
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
      (typeof row[dimension] !== "string" || typeof row[`${dimension}Desc`] !== "string")) {
      return malformed("contains a malformed observation or unsupported unit/indicator");
    }
    const component = row[dimension] || "TOTAL";
    if (!context.tool.spec.input.component.enum?.includes(String(component))) return malformed("contains an unsupported component");
    if (context.tool.spec.input.currency && (
      typeof row.CURRENCY !== "string" || typeof row.CURRENCYDesc !== "string" ||
      !context.tool.spec.input.currency.enum?.includes(row.CURRENCY || "TOTAL")
    )) return malformed("contains a malformed or unsupported currency");
    const billionTable = ["315-38011", "315-38012", "315-38021", "315-38022"].includes(table);
    const expectedUnits = row.sv === "IIP_R"
      ? ["% to GDP", "相對本地生產總值的百分比", "相对本地生产总值的百分比"]
      : billionTable ? ["HK$ billion", "十億港元", "十亿港元"] : ["HK$ million", "百萬港元", "百万港元"];
    if (!expectedUnits.includes(row.svDesc)) return malformed("contains units inconsistent with its table or statistical variable");
    const measure = units[row.svDesc];
    if (!context.tool.spec.input.measure.enum?.includes(measure)) return malformed("contains an unsupported measure");
    return { ...row, component, measure };
  });
  const filtered = rows.filter((row) =>
    (!input.period || String(row.period).startsWith(String(input.period))) &&
    (!input.freq || row.freq === input.freq) &&
    (!input.indicator || row.sv === input.indicator) &&
    (!input.component || row.component === input.component) &&
    (!input.measure || row.measure === input.measure) &&
    (!input.currency || (row.CURRENCY || "TOTAL") === input.currency),
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
