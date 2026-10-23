import type { ResponseTransformer } from "@/lib/mcp/types";
import { UpstreamError } from "@/lib/mcp/fetcher";
import { page, record } from "@/lib/mcp/spatial";
import { contracts } from "./contract";

function malformed(table: string, detail: string): never {
  throw new UpstreamError("upstream_parse", `C&SD business survey ${table} ${detail}; check the official table or try later.`);
}

/** Validate the complete response before filtering, keeping source observations unchanged. */
export const normalizeBusinessTable: ResponseTransformer = (body, input, context) => {
  const table = String(context.tool.spec.query?.id);
  const contract = contracts[table];
  if (!contract || !record(body) || !record(body.header)) return malformed(table, "is missing its header");
  const header = body.header;
  if (!record(header.status) || header.status.code !== 0 || header.status.name !== "Success") return malformed(table, "reported a failed or missing query status");
  if (typeof header.title !== "string" || typeof header.source !== "string" || !Array.isArray(header.tablenote) ||
      !header.tablenote.every((note) => typeof note === "string") || !Array.isArray(body.dataSet)) return malformed(table, "is missing title, source, notes or dataSet");
  const rows = body.dataSet.map((row): Record<string, unknown> => {
    if (!record(row) || row.freq !== contract.freq || typeof row.period !== "string" ||
        !/^\d{4}(0[1-9]|1[0-2])$/.test(row.period) || (row.freq === "Q" && !/(03|06|09|12)$/.test(row.period)) ||
        typeof row.sv !== "string" || !contract.indicators.includes(row.sv) ||
        typeof row.svDesc !== "string" || !Object.hasOwn(contract.units, row.svDesc) ||
        typeof row.sd_value !== "string" || !((typeof row.figure === "number" && Number.isFinite(row.figure)) ||
          (typeof row.figure === "string" && (row.figure === "" || /^-?\d+(\.\d+)?$/.test(row.figure))))) return malformed(table, "contains a malformed observation, period, series or unit");
    const normalized: Record<string, unknown> = { ...row, measure: contract.units[row.svDesc] };
    for (const [dimension, { input: alias, codes }] of Object.entries(contract.dimensions)) {
      const code = row[dimension];
      if (!(typeof code === "string" || (typeof code === "number" && Number.isFinite(code))) ||
          !codes.includes(String(code)) || typeof row[`${dimension}Desc`] !== "string") return malformed(table, `contains a malformed ${dimension} code or label`);
      normalized[alias] = code === "" ? "TOTAL" : String(code);
    }
    return normalized;
  });
  const filtered = rows.filter((row) => (!input.period || String(row.period).startsWith(String(input.period))) &&
    (!input.indicator || row.sv === input.indicator) &&
    Object.values(contract.dimensions).every(({ input: alias }) => !input[alias] || row[alias] === input[alias]))
    .sort((a, b) => String(b.period).localeCompare(String(a.period)));
  const offset = Number(input.offset ?? 0);
  return { table, title: header.title, source: header.source, notes: header.tablenote, language: input.lang ?? "en",
    frequency: contract.freq, total: filtered.length, ...page(filtered.slice(offset), offset, Number(input.limit ?? 50)) };
};
