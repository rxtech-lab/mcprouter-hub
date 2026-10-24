import type { ResponseTransformer, ToolInput } from "@/lib/mcp/types";
import { malformed, page, record } from "@/lib/mcp/spatial";

type Row = Record<string, unknown>;
function strings(row: Row, fields: string[]) {
  return fields.every((field) => Object.hasOwn(row, field) && (row[field] === null || typeof row[field] === "string"));
}
function bounded(rows: Row[], input: ToolInput) {
  const needle = String(input.search ?? "").trim().toLowerCase();
  const selected = rows.filter((row) => !needle || Object.values(row).some((v) => typeof v === "string" && v.toLowerCase().includes(needle)));
  return { total: selected.length, ...page(selected.slice(Number(input.offset)), Number(input.offset), Number(input.limit)) };
}
export const companies: ResponseTransformer = (body, input) => {
  if (!record(body) || !Array.isArray(body.value)) malformed("HKSTP companies");
  const fields = ["type", "type_Name_EN", "type_Name_TC", "type_Name_SC", "cluster", "cluster_TC", "cluster_SC", "telephone", "fax", "email", "website",
    ...["EN", "TC", "SC"].flatMap((l) => ["name", "address", "contact", "introduction", "product"].map((f) => `${f}_${l}`))];
  if (body.value.some((row) => !record(row) || !strings(row, fields) || typeof row.name_EN !== "string" || !row.name_EN.trim())) malformed("HKSTP companies");
  const suffix = String(input.lang).toUpperCase();
  const rows = (body.value as Row[]).filter((r) => !input.cluster || String(r.cluster).toLowerCase() === String(input.cluster).toLowerCase()).map((r) => ({ ...r,
    name: r[`name_${suffix}`], address: r[`address_${suffix}`], introduction: r[`introduction_${suffix}`], product: r[`product_${suffix}`] }));
  return { language: input.lang, ...bounded(rows, input) };
};
export const jobs: ResponseTransformer = (body, input) => {
  const fields = ["Job_Position", "Job_Ref_No", "Company_Name", "Post_Start_Date", "Post_End_Date", "Employment_Type", "Education_Level", "Work_Location", "Career_Level", "Work_Experience", "Job_Industry", "Salary", "Employment_Term"];
  if (!Array.isArray(body) || body.some((row) => !record(row) || !strings(row, fields) || !["Job_Position", "Company_Name"].every((f) => typeof row[f] === "string" && row[f].trim()) ||
    !["Post_Start_Date", "Post_End_Date"].every((f) => typeof row[f] === "string" && /^\d{4}-\d{2}-\d{2}T/.test(row[f]) && Number.isFinite(Date.parse(row[f]))))) malformed("HKSTP recruitment");
  return { language: "source", ...bounded(body, input) };
};
export const space: ResponseTransformer = (body, input) => {
  if (!record(body) || body.item !== "lab & office space" || typeof body.value !== "string" || !body.value.trim()) malformed("HKSTP lab & office space");
  return { language: "source", unit: "sq ft", total: 1, ...page(Number(input.offset) === 0 ? [body] : [], Number(input.offset), Number(input.limit)) };
};
