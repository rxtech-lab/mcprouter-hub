import contracts from "./contract.json";
import { UpstreamError } from "@/lib/mcp/fetcher";
import { record } from "@/lib/mcp/spatial";
import type { HandlerContext, RequestTransformer, ResponseTransformer, ToolInput } from "@/lib/mcp/types";

type Schema = { types: string[]; fields?: Record<string, Schema>; required?: string[] };
type Contract = { url: string; schema: Schema; kind: string };
const sources = contracts as Record<string, Record<string, Record<string, Contract>>>;
function contract(input: ToolInput, context: HandlerContext) {
  const source = sources[context.tool.name]?.[String(input.table ?? "")]?.[String(input.lang ?? "en")];
  if (!source) throw new Error("Unsupported published health table or language.");
  return source;
}
function malformed(): never {
  throw new UpstreamError("upstream_parse", "Health source returned an incomplete or malformed dataset. Check the official source URL or contact the provider.");
}
/** Validate published required columns and nested values before filtering or pagination. */
function validate(value: unknown, schema: Schema): void {
  const type = value === null ? "null" : record(value) ? "object" : typeof value;
  if (!schema.types.includes(type) || (type === "number" && !Number.isFinite(value)) ||
      (type === "string" && (value as string).length > 20000)) malformed();
  if (record(value)) {
    if (schema.required?.some((key) => !(key in value))) malformed();
    for (const [key, child] of Object.entries(value)) {
      const field = schema.fields?.[key];
      // New columns are preserved when scalar; known columns retain their contract.
      if (field) validate(child, field);
      else if (child !== null && !["string", "number"].includes(typeof child)) malformed();
    }
  }
}
export const request: RequestTransformer = (built, input, context) => ({ ...built, url: contract(input, context).url });

export const response: ResponseTransformer = (body, input, context) => {
  const source = contract(input, context);
  const lang = String(input.lang ?? "en");
  let rows: Record<string, unknown>[];
  if (source.kind === "dhce" || source.kind === "wws") {
    if (record(body) && record(body.error)) throw new UpstreamError("upstream_http", "CSDI rejected the health directory query. Check the official source URL.");
    if (!record(body) || !Array.isArray(body.features) || body.features.length > 100 || body.exceededTransferLimit === true) malformed();
    rows = body.features.map((feature) => {
      if (!record(feature) || !record(feature.attributes) || !record(feature.geometry)) malformed();
      validate(feature.attributes, source.schema);
      const { x, y } = feature.geometry;
      if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 180 || Math.abs(y) > 90) malformed();
      const suffix = lang === "en" ? "EN" : "TC";
      return { ...feature.attributes, name: feature.attributes[`Name${suffix}`], address: feature.attributes[`Address${suffix}`],
        telephone: feature.attributes[`Telephone${suffix}`], fax: feature.attributes[`Fax${suffix}`], website: feature.attributes[`Website${suffix}`], longitude: x, latitude: y };
    });
  } else {
    const data = body;
    if (!Array.isArray(data) || data.length > 100000) malformed();
    rows = data.map((row) => {
      if (!record(row)) malformed();
      validate(row, source.schema);
      if (source.kind === "cmctr" || source.kind === "facilities") {
        const suffix = lang === "en" ? "eng" : lang;
        const { latitude, longitude } = row;
        if (typeof latitude !== "number" || typeof longitude !== "number" || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) malformed();
        return { ...row, name: row[`${source.kind === "cmctr" ? "CMCTR" : "institution"}_${suffix}`], address: row[`address_${suffix}`] };
      }
      return row;
    });
  }
  const term = String(input.search ?? "").trim().toLowerCase();
  const matches = (value: unknown): boolean => typeof value === "string" ? value.toLowerCase().includes(term) : record(value) && Object.values(value).some(matches);
  rows = rows.filter((row) => (!term || Object.values(row).some(matches)) && (!input.year || row["Financial Year"] === input.year));
  const offset = Number(input.offset ?? 0);
  const results: Record<string, unknown>[] = [];
  let bytes = 0;
  for (const row of rows.slice(offset, offset + Number(input.limit ?? 20))) {
    const size = Buffer.byteLength(JSON.stringify(row));
    if (size > 80000) malformed();
    if (bytes + size > 80000) break;
    results.push(row); bytes += size;
  }
  const hasMore = offset + results.length < rows.length;
  return { source: source.url, language: lang, ...(input.table ? { table: input.table } : {}),
    ...(["ambulatory", "inpatient", "cmctr-throughput"].includes(source.kind) ? { notes: "Financial years, source units and nulls preserved. Overall totals overlap breakdowns; do not sum overlapping rows." } : {}),
    total: rows.length, returned: results.length, hasMore, nextOffset: hasMore ? offset + results.length : null, results };
};
