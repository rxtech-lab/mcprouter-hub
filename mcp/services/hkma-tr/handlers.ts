import type { ResponseTransformer } from "@/lib/mcp/types";
import { malformed, page, record } from "@/lib/mcp/spatial";
import { UpstreamError } from "@/lib/mcp/fetcher";
import { numericFields } from "./fields";

export const normalize: ResponseTransformer = (body, input, context) => {
  const source = "HKMA trade repository";
  if (!record(body) || !record(body.header) || typeof body.header.success !== "boolean") malformed(source);
  if (!body.header.success) throw new UpstreamError("upstream_parse", `${source} rejected the request (${String(body.header.err_code).slice(0, 40)}). Check the official HKMA resource.`);
  if (!record(body.result) || !Array.isArray(body.result.records) || !Number.isSafeInteger(body.result.datasize) ||
    body.result.datasize !== body.result.records.length || body.result.records.length > Number(input.limit)) malformed(source);
  const positions = context.tool.name === "hktr_interest_rate_positions";
  for (const row of body.result.records) {
    if (!record(row)) malformed(source);
    if (positions) {
      if (typeof row.end_of_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.end_of_date) ||
        !Number.isFinite(Date.parse(row.end_of_date)) || new Date(row.end_of_date).toISOString().slice(0, 10) !== row.end_of_date ||
        numericFields.some((key) => !(row[key] === null || (typeof row[key] === "number" && Number.isFinite(row[key]))))) malformed(source);
    } else if (["tr_code", "tr_name", "subscribed_service"].some((key) => typeof row[key] !== "string" || !row[key]) ||
      !(row.global_lei === null || typeof row.global_lei === "string")) malformed(source);
  }
  return { language: "en", upstreamPageSize: body.result.datasize,
    ...page(body.result.records, Number(input.offset), Number(input.limit), body.result.records.length === Number(input.limit)) };
};
