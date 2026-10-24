import { UpstreamError } from "@/lib/mcp/fetcher";
import { record, malformed, page } from "@/lib/mcp/spatial";
import type { ResponseTransformer } from "@/lib/mcp/types";
import { contracts } from "./contract";

/** Validate before filtering so malformed source records cannot masquerade as no matches. */
export const normalize: ResponseTransformer = (body, input, context) => {
  const table = String(context.tool.spec.query?.id);
  const contract = contracts[table as keyof typeof contracts];
  if (!contract || !record(body) || !record(body.header)) malformed(`C&SD ${table}`);
  const header = body.header;
  if (!record(header.status)) malformed(`C&SD ${table} status`);
  if (header.status.code !== 0 || header.status.name !== "Success") {
    throw new UpstreamError("upstream_http", `C&SD ${table} reported query failure; check the official table or retry later.`);
  }
  if (typeof header.title !== "string" || typeof header.source !== "string" ||
      !Array.isArray(header.tablenote) || !header.tablenote.every((n) => typeof n === "string") || !Array.isArray(body.dataSet)) malformed(`C&SD ${table}`);
  const rows = body.dataSet.map((row): Record<string, unknown> => {
    if (!record(row) || typeof row.freq !== "string" || !context.tool.spec.input.freq.enum?.includes(row.freq) ||
        typeof row.period !== "string" || !(row.freq === "Y" ? /^\d{4}$/ : /^\d{4}(03|06|09|12)$/).test(row.period) ||
        typeof row.sv !== "string" || !contract.indicators.includes(row.sv) || typeof row.svDesc !== "string" ||
        !Object.hasOwn(contract.units, row.svDesc) || typeof row.sd_value !== "string" ||
        !((typeof row.figure === "number" && Number.isFinite(row.figure)) ||
          (typeof row.figure === "string" && (row.figure === "" || /^-?\d+(\.\d+)?$/.test(row.figure))))) malformed(`C&SD ${table} observation`);
    for (const dim of contract.dimensions) {
      const codes: Record<string, string[]> = contract.codes;
      if (typeof row[dim] !== "string" || !codes[dim].includes(row[dim]) || typeof row[`${dim}Desc`] !== "string") malformed(`C&SD ${table} ${dim}`);
    }
    const units: Record<string, string> = contract.units;
    return { ...row, measure: units[row.svDesc] };
  });
  const filtered = rows.filter((row) => (!input.freq || row.freq === input.freq) &&
    (!input.period || String(row.period).startsWith(String(input.period))) && (!input.indicator || row.sv === input.indicator) &&
    contract.dimensions.every((dim) => input[dim] === undefined || row[dim] === (input[dim] === "TOTAL" ? "" : input[dim])))
    .sort((a, b) => String(b.period).localeCompare(String(a.period)));
  const offset = Number(input.offset ?? 0);
  return { table, title: header.title, language: input.lang ?? "en", notes: header.tablenote, source: header.source,
    total: filtered.length, ...page(filtered.slice(offset), offset, Number(input.limit ?? 20)) };
};
