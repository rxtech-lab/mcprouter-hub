import { UpstreamError } from "@/lib/mcp/fetcher";
import type { ResponseTransformer } from "@/lib/mcp/types";

const measures: Record<string, string> = {
  "Year-on-year % change": "yoy", "按年變動百分率": "yoy", "按年变动百分率": "yoy",
  "Quarter-to-quarter % change": "qoq", "按季變動百分率": "qoq", "按季变动百分率": "qoq",
  "% point": "contribution", "百分點": "contribution", "百分点": "contribution",
  "%": "ratio",
  "Percentage distribution (%)": "distribution", "百分比分布(%)": "distribution",
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function malformed(detail: string): never {
  throw new UpstreamError("upstream_parse", `C&SD GDP response ${detail}. Retry later or check the official web table.`);
}

/** Keep source figures and status flags intact; never turn unavailable values into zero. */
export const normalizeGdpTable: ResponseTransformer = (body, input, context) => {
  if (!record(body) || !record(body.header)) return malformed("is missing its header");
  const header = body.header;
  if (!record(header.status) || header.status.code !== 0 || header.status.name !== "Success") {
    return malformed("reported a failed or missing query status");
  }
  if (!Array.isArray(body.dataSet) || typeof header.title !== "string") return malformed("is missing its title or dataSet array");

  const rows = body.dataSet.map((row): Record<string, unknown> => {
    if (!record(row) || !["Y", "Q"].includes(String(row.freq)) ||
      typeof row.period !== "string" || !/^\d{4}(03|06|09|12)?$/.test(row.period) ||
      (row.freq === "Y" ? row.period.length !== 4 : row.period.length !== 6) ||
      typeof row.sv !== "string" || typeof row.svDesc !== "string" ||
      !(typeof row.figure === "string" || (typeof row.figure === "number" && Number.isFinite(row.figure))) ||
      typeof row.sd_value !== "string" ||
      (row.GDP_COMPONENT !== undefined && typeof row.GDP_COMPONENT !== "string") ||
      (row.GDP_COMPONENTDesc !== undefined && typeof row.GDP_COMPONENTDesc !== "string")) {
      return malformed("contains a malformed observation");
    }
    return {
      ...row,
      component: row.GDP_COMPONENT || "TOTAL",
      measure: row.svDesc === "%" && context.tool.spec.query?.id === "310-31015"
        ? "distribution" : measures[row.svDesc] ?? "level",
    };
  });
  const filtered = rows.filter((row) =>
    (!input.period || String(row.period).startsWith(String(input.period))) &&
    (!input.freq || row.freq === input.freq) &&
    (!input.indicator || row.sv === input.indicator) &&
    (!input.component || row.component === input.component) &&
    (!input.measure || row.measure === input.measure),
  ).sort((a, b) => String(b.period).localeCompare(String(a.period)));

  const offset = Number(input.offset ?? 0);
  const limit = Number(input.limit ?? 50);
  const results = filtered.slice(offset, offset + limit);
  const hasMore = offset + results.length < filtered.length;
  return {
    table: String(context.tool.spec.query?.id),
    title: header.title,
    language: input.lang ?? "en",
    notes: header.tablenote ?? [],
    source: header.source,
    total: filtered.length,
    returned: results.length,
    hasMore,
    nextOffset: hasMore ? offset + results.length : null,
    results,
  };
};
