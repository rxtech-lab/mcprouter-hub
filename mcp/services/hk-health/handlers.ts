import Papa from "papaparse";
import { UpstreamError } from "@/lib/mcp/fetcher";
import type { ResponseTransformer, ToolInput } from "@/lib/mcp/types";

type Row = Record<string, unknown>;
const record = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);
function malformed(detail: string): never {
  throw new UpstreamError("upstream_parse", `Health source ${detail}. Check the official dataset or contact its provider.`);
}
function page(rows: Row[], input: ToolInput, metadata: Row) {
  const search = String(input.search ?? "").toLowerCase();
  const filtered = rows.filter((row) => !search || Object.values(row).some((v) => typeof v === "string" && v.toLowerCase().includes(search)));
  const offset = Number(input.offset ?? 0);
  const results: Row[] = [];
  let bytes = 0;
  for (const row of filtered.slice(offset, offset + Number(input.limit ?? 20))) {
    const size = Buffer.byteLength(JSON.stringify(row));
    if (size > 50000) malformed("contains an oversized record");
    if (bytes + size > 80000) break;
    results.push(row); bytes += size;
  }
  const hasMore = offset + results.length < filtered.length;
  return { ...metadata, language: input.lang ?? "en", total: filtered.length, returned: results.length,
    hasMore, nextOffset: hasMore ? offset + results.length : null, results };
}

const dimensions: Record<string, string[]> = {
  "930-92090": ["ICD10", "SEX"], "930-92092": ["GRADE", "VACC"], "930-92093": ["TYPE_HA_SERVICES"],
};
export const statistics: ResponseTransformer = (body, input, context) => {
  const table = String(context.tool.spec.query?.id);
  if (!dimensions[table] || !record(body) || !record(body.header) || !record(body.header.status) ||
    body.header.status.code !== 0 || body.header.status.name !== "Success" || typeof body.header.title !== "string" ||
    !Array.isArray(body.dataSet) || body.dataSet.length > 100000) malformed("has an invalid table header or query status");
  const header = body.header;
  if (!Array.isArray(header.tablenote) || header.tablenote.some((n) => typeof n !== "string") ||
    typeof header.source !== "string" || Buffer.byteLength(JSON.stringify(header.tablenote)) > 20000) malformed("has invalid source notes");
  const rows = body.dataSet.map((row) => {
    if (!record(row) || !context.tool.spec.input.freq.enum?.includes(String(row.freq)) ||
      typeof row.period !== "string" || !(row.freq === "Y" ? /^\d{4}$/ : /^\d{4}(03|06|09|12)$/).test(row.period) ||
      !context.tool.spec.input.indicator.enum?.includes(String(row.sv)) || typeof row.svDesc !== "string" ||
      !((typeof row.figure === "number" && Number.isFinite(row.figure)) || (typeof row.figure === "string" && row.figure.length <= 100)) ||
      typeof row.sd_value !== "string" || dimensions[table].some((d) => typeof row[d] !== "string" || typeof row[`${d}Desc`] !== "string")) malformed("contains a malformed statistical observation");
    return row;
  }).filter((row) => (!input.period || String(row.period).startsWith(String(input.period))) &&
    (!input.freq || row.freq === input.freq) && (!input.indicator || row.sv === input.indicator))
    .sort((a, b) => String(b.period).localeCompare(String(a.period)));
  return page(rows, input, { table, title: header.title, notes: header.tablenote, source: header.source,
    periodMeaning: table === "930-92092" ? "Academic year starting in September" : "Calendar year or quarter ending month" });
};

export const clinics: ResponseTransformer = (body, input) => {
  if (record(body) && record(body.error)) throw new UpstreamError("upstream_http", "CSDI rejected the clinic query. Check the official clinic dataset.");
  if (!record(body) || !Array.isArray(body.features) || body.features.length > 100 || body.exceededTransferLimit === true) malformed("has an incomplete or malformed clinic directory");
  const suffix = { en: "EN", tc: "TC", sc: "SC" }[String(input.lang ?? "en")]!;
  const rows = body.features.map((feature) => {
    if (!record(feature) || !record(feature.attributes)) malformed("contains malformed clinic attributes");
    const a = feature.attributes;
    if (!Number.isInteger(a.OBJECTID) || ["EN", "TC", "SC"].some((lang) => ["Name", "Address"].some((field) => typeof a[`${field}_${lang}`] !== "string"))) malformed("contains malformed clinic attributes");
    const g = feature.geometry;
    if (!record(g) || typeof g.x !== "number" || typeof g.y !== "number" || !Number.isFinite(g.x) || !Number.isFinite(g.y) || Math.abs(g.x) > 180 || Math.abs(g.y) > 90) malformed("contains invalid clinic coordinates");
    return { ...a, name: a[`Name_${suffix}`], address: a[`Address_${suffix}`], longitude: g.x, latitude: g.y };
  });
  return page(rows, input, { coordinateSystem: "WGS84 (longitude, latitude)" });
};

export const flu: ResponseTransformer = (body, input) => {
  if (typeof body !== "string" || body.length > 5000000) malformed("has invalid Flu Express CSV content");
  const parsed = Papa.parse<Record<string, string>>(body.replace(/^\uFEFF/, "").trim(), { header: true, skipEmptyLines: true });
  if (parsed.errors.length || !parsed.meta.fields || !["Year", "Week", "From", "To", "H1", "H3", "B", "AandB"].every((f) => parsed.meta.fields!.includes(f))) malformed("has malformed Flu Express CSV headers or rows");
  const rows = parsed.data.map((row) => {
    if (!/^\d{4}$/.test(row.Year) || !/^\d{1,2}$/.test(row.Week) || Number(row.Week) < 1 || Number(row.Week) > 53 ||
      !/^\d{2}\/\d{2}\/\d{4}$/.test(row.From) || !/^\d{2}\/\d{2}\/\d{4}$/.test(row.To) ||
      Object.entries(row).some(([key, value]) => !["From", "To"].includes(key) && value !== "" && !/^\d+(\.\d+)?$/.test(value))) malformed("contains a malformed influenza week or figure");
    return row;
  }).filter((row) => (!input.year || Number(row.Year) === input.year) && (!input.week || Number(row.Week) === input.week))
    .sort((a, b) => Number(b.Year) - Number(a.Year) || Number(b.Week) - Number(a.Week));
  return page(rows, input, { sourceLanguage: "en", columns: parsed.meta.fields, notes: ["Source columns and numeric strings are preserved. Empty strings mean missing data. Proportion columns contain fractions, not percentages."] });
};
