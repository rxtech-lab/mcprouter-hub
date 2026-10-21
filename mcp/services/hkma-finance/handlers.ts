import type { RequestTransformer, ResponseTransformer } from "@/lib/mcp/types";
import { malformed, page, record } from "@/lib/mcp/spatial";
import { UpstreamError } from "@/lib/mcp/fetcher";

const dateFields: Record<string, string> = { hkma_hibor: "end_of_day" };
function calendarDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export const hkmaRequest: RequestTransformer = (request, input, context) => {
  const url = new URL(request.url);
  const date = dateFields[context.tool.name];
  if (date) {
    for (const key of ["from", "to"]) if (input[key] !== undefined && !calendarDate(input[key])) throw new Error(`${key} must be a valid ISO calendar date.`);
    if (input.from && input.to && String(input.from) > String(input.to)) throw new Error("from must be on or before to.");
    url.searchParams.set("sortby", date);
    url.searchParams.set("sortorder", "desc");
    if (input.from || input.to) {
      url.searchParams.set("column", date);
      for (const key of ["from", "to"]) if (input[key]) url.searchParams.set(key, String(input[key]));
    }
  }
  return { ...request, url: url.toString() };
};

function validateRow(row: unknown, tool: string) {
  if (!record(row)) return false;
  const date = dateFields[tool];
  if (date) {
    if (!calendarDate(row[date])) return false;
    const numeric = ["ir_overnight", "ir_1m", "ir_3m"];
    return numeric.every((field) => Object.hasOwn(row, field) && (row[field] === null || typeof row[field] === "number"));
  }
  return false;
}

export const hkmaResponse: ResponseTransformer = (body, input, context) => {
  const source = `HKMA ${context.tool.name}`;
  if (!record(body) || !record(body.header) || typeof body.header.success !== "boolean") malformed(source);
  if (!body.header.success) throw new UpstreamError("upstream_parse", `${source} rejected the request (${String(body.header.err_code ?? "unknown").slice(0, 40)}). Check the search criteria or retry the official API later.`);
  if (!record(body.result) || !Array.isArray(body.result.records) || !Number.isSafeInteger(body.result.datasize) ||
    Number(body.result.datasize) !== body.result.records.length || body.result.records.some((row) => !validateRow(row, context.tool.name))) malformed(source);
  const rows = body.result.records;
  const limit = Number(input.limit);
  // HKMA datasize is the current page length. An exactly full page needs a continuation probe.
  if (rows.length > limit) malformed(source);
  return { language: input.lang ?? "en", upstreamPageSize: body.result.datasize,
    ...page(rows, Number(input.offset), limit, rows.length === limit) };
};
