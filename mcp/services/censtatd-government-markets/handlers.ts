import { UpstreamError } from "@/lib/mcp/fetcher";
import type { ResponseTransformer } from "@/lib/mcp/types";
import { contracts } from "./contract";

type Contract = { dimension: string; byIndicator: Record<string, { dimension: boolean; components: readonly string[]; measures: readonly string[] }>; units: Record<string, string> };
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function malformed(detail: string): never {
  throw new UpstreamError("upstream_parse", `C&SD financial table ${detail}. Retry later or check the official web table.`);
}

/** Validate the entire table before filtering, preserving all source observations. */
export const normalizeGovernmentMarketTable: ResponseTransformer = (body, input, context) => {
  const table = String(context.tool.spec.query?.id);
  const contract: Contract | undefined = (contracts as Record<string, Contract>)[table];
  if (!contract) return malformed("has an unsupported ID");
  if (!record(body) || !record(body.header)) return malformed("is missing its header");
  const header = body.header;
  if (!record(header.status) || header.status.code !== 0 || header.status.name !== "Success") return malformed("reported a failed or missing query status");
  if (typeof header.title !== "string" || typeof header.source !== "string" || !Array.isArray(header.tablenote) ||
    !header.tablenote.every((note) => typeof note === "string") || !Array.isArray(body.dataSet)) return malformed("is missing its title, source, notes or dataSet");
  const rows = body.dataSet.map((row): Record<string, unknown> => {
    if (!record(row) || typeof row.freq !== "string" || !context.tool.spec.input.freq.enum?.includes(row.freq) ||
      typeof row.period !== "string" || !/^\d{4}(0[1-9]|1[0-2])?$/.test(row.period) ||
      (row.freq === "Y" ? row.period.length !== 4 : row.period.length !== 6) ||
      (row.freq === "Q" && !/(03|06|09|12)$/.test(row.period)) ||
      typeof row.sv !== "string" || !Object.hasOwn(contract.byIndicator, row.sv) ||
      typeof row.svDesc !== "string" || !Object.hasOwn(contract.units, row.svDesc) ||
      !((typeof row.figure === "string" && (row.figure === "" || /^-?\d+(\.\d+)?$/.test(row.figure))) || (typeof row.figure === "number" && Number.isFinite(row.figure))) ||
      typeof row.sd_value !== "string") return malformed("contains a malformed observation, period, indicator or unit");
    const indicator = contract.byIndicator[row.sv];
    const dimension = contract.dimension;
    let component = "NONE";
    if (indicator.dimension) {
      const code = row[dimension];
      if (!(typeof code === "string" || (typeof code === "number" && Number.isFinite(code))) || typeof row[`${dimension}Desc`] !== "string") return malformed("contains a missing or malformed component code or label");
      component = code === "" ? "TOTAL" : String(code);
    } else if (dimension && (dimension in row || `${dimension}Desc` in row)) return malformed("contains an unexpected component dimension");
    if (!indicator.components.includes(component)) return malformed("contains an unsupported component for its indicator");
    const measure = contract.units[row.svDesc];
    if (!indicator.measures.includes(measure)) return malformed("contains units inconsistent with its indicator");
    return { ...row, component, measure };
  });
  const filtered = rows.filter((row) =>
    (!input.period || String(row.period).startsWith(String(input.period))) &&
    (!input.freq || row.freq === input.freq) && (!input.indicator || row.sv === input.indicator) &&
    (!input.component || row.component === input.component) && (!input.measure || row.measure === input.measure),
  ).sort((a, b) => String(b.period).localeCompare(String(a.period)));
  const offset = Number(input.offset ?? 0);
  const results = filtered.slice(offset, offset + Number(input.limit ?? 50));
  const hasMore = offset + results.length < filtered.length;
  return { table, title: header.title, language: input.lang ?? "en", componentType: contract.dimension || null,
    notes: header.tablenote, source: header.source, total: filtered.length, returned: results.length, hasMore,
    nextOffset: hasMore ? offset + results.length : null, results };
};
