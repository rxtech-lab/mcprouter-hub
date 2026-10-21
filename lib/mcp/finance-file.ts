import Papa from "papaparse";
import { stripBom } from "@/lib/mcp/fetcher";
import { malformed, page } from "@/lib/mcp/spatial";
import type { ToolInput } from "@/lib/mcp/types";

/** Validate every column before mapping. Preserve strings, leading zeros and quoted multiline cells. */
export function financeCsv(body: unknown, source: string, headers: readonly string[]) {
  if (typeof body !== "string") malformed(source);
  // The published Simplified Chinese warehouse file mixes lone CR and CRLF.
  const parsed = Papa.parse<string[]>(stripBom(body).replace(/\r\n?/g, "\n").trim(), { skipEmptyLines: "greedy" });
  const [header, ...rows] = parsed.data;
  if (parsed.errors.length || header?.length !== headers.length ||
    header.some((value, index) => value.trim() !== headers[index]) ||
    rows.some((row) => row.length < headers.length || row.slice(headers.length).some((value) => value.trim()))) malformed(source);
  return rows.map((row) => row.slice(0, headers.length).map((value) => value.trim()));
}

export function filePage(rows: Record<string, string>[], input: ToolInput, source: string) {
  const needle = String(input.search ?? "").trim().toLowerCase();
  const filtered = rows.filter((row) => (!input.licence || row.licence === input.licence) &&
    (!needle || Object.values(row).some((value) => value.toLowerCase().includes(needle))));
  const offset = Number(input.offset);
  return { source, language: input.lang, total: filtered.length,
    ...page(filtered.slice(offset), offset, Number(input.limit)) };
}
