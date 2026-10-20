import type { RequestTransformer, ResponseTransformer } from "@/lib/mcp/types";
import { malformed, page, record } from "@/lib/mcp/spatial";

export const validateStop: RequestTransformer = (request, input) => {
  if (input.operator === "CTB" && !/^[0-9]{6}$/.test(String(input.stopId))) {
    throw new Error("Citybus stopId must contain exactly six digits, e.g. 001001.");
  }
  return request;
};

export const batch: ResponseTransformer = (body, input) => {
  if (!record(body) || !Array.isArray(body.data) || typeof body.generated_timestamp !== "string" ||
      body.data.some((row) => !record(row) || typeof row.co !== "string" || typeof row.stop !== "string")) malformed("DPO bus batch");
  const offset = Number(input.offset ?? 0);
  return { ...page(body.data.slice(offset), offset, Number(input.limit ?? 200)), total: body.data.length, generatedAt: body.generated_timestamp };
};
