import type { ResponseTransformer } from "@/lib/mcp/types";
import { UpstreamError } from "@/lib/mcp/fetcher";
import { page, record } from "@/lib/mcp/spatial";
import { contracts } from "./contract";

function malformed(table: string, detail: string): never {
  throw new UpstreamError("upstream_parse", `C&SD table ${table} ${detail}; check the official table or try later.`);
}

/** Validate every observation before filtering; preserve source values, flags and units. */
export const normalizeEnergy: ResponseTransformer = (body, input, context) => {
  const table = String(context.tool.spec.query?.id);
  const contract = contracts[table];
  if (!contract || !record(body) || !record(body.header)) return malformed(table, "is missing its header");
  const header = body.header;
  if (!record(header.status) || header.status.code !== 0 || header.status.name !== "Success") return malformed(table, "reported a failed or missing query status");
  if (typeof header.title !== "string" || !header.title || typeof header.source !== "string" ||
      !Array.isArray(header.tablenote) || !header.tablenote.every((note) => typeof note === "string") ||
      !Array.isArray(body.dataSet)) return malformed(table, "is missing title, source, notes or dataSet");
  if (!record(header.count) || header.count.noOfRecords !== body.dataSet.length) return malformed(table, "has a missing or inconsistent record count");
  const rows = body.dataSet.map((row): Record<string, unknown> => {
    if (!record(row) || typeof row.freq !== "string" || !contract.frequencies.includes(row.freq) ||
        typeof row.period !== "string" || !(row.freq === "Y" ? /^\d{4}$/ : /^\d{4}(0[1-9]|1[0-2])$/).test(row.period) ||
        (row.freq === "Q" && !/(03|06|09|12)$/.test(row.period)) ||
        typeof row.sv !== "string" || !Object.hasOwn(contract.indicatorUnits, row.sv) ||
        typeof row.svDesc !== "string" || !contract.indicatorUnits[row.sv].includes(row.svDesc) ||
        typeof row.sd_value !== "string" || !((typeof row.figure === "number" && Number.isFinite(row.figure)) ||
          (typeof row.figure === "string" && (row.figure === "" || /^-?\d+(\.\d+)?$/.test(row.figure))))) return malformed(table, "contains a malformed period, observation, indicator or unit");
    const normalized: Record<string, unknown> = { ...row, measure: contract.units[row.svDesc] };
    for (const [dimension, { input: alias, codes }] of Object.entries(contract.dimensions)) {
      const code = row[dimension];
      if (code === undefined && contract.dimensions[dimension].absentIndicators.includes(String(row.sv)) && !Object.hasOwn(row, dimension) && !Object.hasOwn(row, `${dimension}Desc`)) {
        normalized[alias] = null;
        continue;
      }
      if (!(typeof code === "string" || (typeof code === "number" && Number.isFinite(code))) ||
          !codes.includes(String(code)) || typeof row[`${dimension}Desc`] !== "string") return malformed(table, `contains a malformed ${dimension} code or label`);
      normalized[alias] = code === "" ? "TOTAL" : String(code);
    }
    const series = JSON.stringify([row.sv, ...Object.keys(contract.dimensions).map((dimension) => row[dimension] === undefined ? null : String(row[dimension]))]);
    if (!contract.seriesUnits[series]?.includes(row.svDesc)) return malformed(table, "contains an indicator, category or unit combination absent from the official contract");
    return normalized;
  });
  const filtered = rows.filter((row) => (!input.period || String(row.period).startsWith(String(input.period))) &&
    (!input.freq || row.freq === input.freq) && (!input.indicator || row.sv === input.indicator) &&
    (!input.measure || row.measure === input.measure) &&
    Object.values(contract.dimensions).every(({ input: alias }) => !input[alias] || row[alias] === input[alias]))
    .sort((a, b) => String(b.period).localeCompare(String(a.period)));
  const offset = Number(input.offset ?? 0);
  return { table, title: header.title, source: header.source, notes: header.tablenote, language: input.lang ?? "en",
    indexReferencePeriod: contract.indexReferencePeriod, seasonallyAdjusted: contract.seasonallyAdjusted, total: filtered.length, ...page(filtered.slice(offset), offset, Number(input.limit ?? 50)) };
};
