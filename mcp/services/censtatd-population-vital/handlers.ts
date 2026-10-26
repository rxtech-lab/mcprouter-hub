import { UpstreamError } from "@/lib/mcp/fetcher";
import { record, malformed, page } from "@/lib/mcp/spatial";
import type { ResponseTransformer } from "@/lib/mcp/types";
import { contracts } from "./contract";

/** Validate every observation before filtering, preserving original source values. */
export const normalize: ResponseTransformer = (body, input, context) => {
  const table = String(context.tool.spec.query?.id);
  const contract = contracts[table];
  const lang = String(input.lang ?? "en");
  if (!contract || !record(body) || !record(body.header)) malformed(`C&SD ${table}`);
  const header = body.header;
  if (!record(header.status)) malformed(`C&SD ${table} status`);
  if (header.status.code !== 0 || header.status.name !== "Success") {
    throw new UpstreamError("upstream_http", `C&SD ${table} reported query failure; consult the official table and its API help.`);
  }
  if (typeof header.title !== "string" || !header.title.trim() || typeof header.source !== "string" ||
      !Array.isArray(header.tablenote) || !header.tablenote.every((n) => typeof n === "string") ||
      !Array.isArray(body.dataSet)) malformed(`C&SD ${table} header or dataset`);
  const rows = body.dataSet.map((row): Record<string, unknown> => {
    if (!record(row) || typeof row.freq !== "string" || !contract.frequencies.includes(row.freq) ||
        typeof row.period !== "string" || !(row.freq === "Y" ? /^\d{4}$/ : /^\d{4}(0[1-9]|1[0-2])$/).test(row.period) ||
        typeof row.sv !== "string" || !Object.hasOwn(contract.indicators, row.sv) ||
        typeof row.svDesc !== "string" || !Object.hasOwn(contract.units[lang][row.sv], row.svDesc) ||
        typeof row.sd_value !== "string" ||
        !((typeof row.figure === "number" && Number.isFinite(row.figure)) ||
          (typeof row.figure === "string" && (row.figure === "" || /^-?\d+(\.\d+)?$/.test(row.figure))))) malformed(`C&SD ${table} observation`);
    const dimensions = contract.indicators[row.sv];
    for (const [dim, codes] of Object.entries(contract.dimensions)) {
      if (dimensions.includes(dim)) {
        if (!((typeof row[dim] === "string" || (typeof row[dim] === "number" && Number.isFinite(row[dim]))) &&
            codes.includes(String(row[dim]))) || typeof row[`${dim}Desc`] !== "string") malformed(`C&SD ${table} ${dim}`);
      } else if (Object.hasOwn(row, dim) || Object.hasOwn(row, `${dim}Desc`)) malformed(`C&SD ${table} unexpected ${dim}`);
    }
    return { ...row, measure: contract.units[lang][row.sv][row.svDesc] };
  });
  const filtered = rows.filter((row) => (!input.freq || row.freq === input.freq) &&
    (!input.period || String(row.period).startsWith(String(input.period))) &&
    (!input.indicator || row.sv === input.indicator) && (!input.measure || row.measure === input.measure) &&
    Object.keys(contract.dimensions).every((dim) => input[dim] === undefined ||
      (Object.hasOwn(row, dim) && String(row[dim]) === (input[dim] === "TOTAL" ? "" : input[dim]))))
    .sort((a, b) => String(b.period).localeCompare(String(a.period)));
  const offset = Number(input.offset ?? 0);
  return { table, title: header.title, language: lang, notes: header.tablenote, source: header.source,
    total: filtered.length, ...page(filtered.slice(offset), offset, Number(input.limit ?? 20)) };
};
