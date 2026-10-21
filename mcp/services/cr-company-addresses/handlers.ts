import type { RequestTransformer, ResponseTransformer } from "@/lib/mcp/types";
import { malformed, page, record } from "@/lib/mcp/spatial";

export const addressRequest: RequestTransformer = (request, input) => {
  if (String(input.value).trim().length < 2) throw new Error("Search value must contain at least two nonblank characters.");
  const url = new URL(request.url);
  url.searchParams.set("query[0][key1]", String(input.field));
  url.searchParams.set("query[0][key2]", String(input.operator));
  url.searchParams.set("query[0][key3]", String(input.value).trim());
  return { ...request, url: url.toString() };
};

export const addressResponse: ResponseTransformer = (body, input) => {
  const source = "Companies Registry office addresses";
  const address = input.register === "foreign" ? "Principal_Place_of_Business_in_H.K." : "Address_of_Registered_Office";
  if (!Array.isArray(body) || body.some((row) => !record(row) || typeof row.Brn !== "string" ||
    !(typeof row[address] === "string" || row[address] === null) || typeof row.Company_Type !== "string")) malformed(source);
  const offset = Number(input.offset);
  return { register: input.register, language: "bilingual-original", total: body.length,
    ...page(body.slice(offset), offset, Number(input.limit)) };
};
