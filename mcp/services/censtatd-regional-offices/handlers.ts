import type { ResponseTransformer } from "@/lib/mcp/types";
import { malformed, page, record } from "@/lib/mcp/spatial";
import { contracts } from "./contract";

export const normalize: ResponseTransformer = (body, input, context) => {
  const table = String(context.tool.spec.query?.id);
  const contract = contracts[table];
  if (!contract || !record(body) || !record(body.header)) malformed("C&SD regional offices");
  const header = body.header;
  if (!record(header.status) || header.status.code !== 0 || header.status.name !== "Success" ||
    typeof header.title !== "string" || typeof header.source !== "string" || !Array.isArray(header.tablenote) ||
    !header.tablenote.every((note) => typeof note === "string") || !Array.isArray(body.dataSet)) malformed("C&SD regional offices");
  const rows = body.dataSet.map((row): Record<string, unknown> => {
    if (!record(row) || row.freq !== "Y" || typeof row.period !== "string" || !/^\d{4}$/.test(row.period) ||
      row.sv !== contract.indicator || typeof row.svDesc !== "string" || !Object.hasOwn(contract.units, row.svDesc) ||
      typeof row.STATUS !== "string" || !context.tool.spec.input.status.enum?.includes(row.STATUS) || typeof row.STATUSDesc !== "string" ||
      typeof row.sd_value !== "string" || !((typeof row.figure === "number" && Number.isFinite(row.figure)) ||
        (typeof row.figure === "string" && (row.figure === "" || /^-?\d+(\.\d+)?$/.test(row.figure))))) malformed("C&SD regional offices observation");
    if (table === "325-43011" && (!(typeof row.COUNTRY_PARENT === "number" || typeof row.COUNTRY_PARENT === "string") ||
      !context.tool.spec.input.country.enum?.includes(String(row.COUNTRY_PARENT)) || typeof row.COUNTRY_PARENTDesc !== "string")) malformed("C&SD parent location");
    return { ...row, measure: contract.units[row.svDesc] };
  });
  const filtered = rows.filter((row) => (!input.period || row.period === input.period) &&
    (!input.status || row.STATUS === input.status) && (!input.country || String(row.COUNTRY_PARENT) === input.country) &&
    (!input.measure || row.measure === input.measure)).sort((a, b) => String(b.period).localeCompare(String(a.period)));
  const offset = Number(input.offset);
  return { table, title: header.title, source: header.source, notes: header.tablenote, language: input.lang,
    total: filtered.length, ...page(filtered.slice(offset), offset, Number(input.limit)) };
};
