import Papa from "papaparse";
import { stripBom } from "@/lib/mcp/fetcher";
import { malformed } from "@/lib/mcp/spatial";

/** Parse positional file schemas, including quoted multiline cells and trailing empty columns. */
export function csvDataset(body: unknown, source: string, firstHeader: string, columns: number) {
  if (typeof body !== "string") malformed(source);
  const parsed = Papa.parse<string[]>(stripBom(body).trim(), { skipEmptyLines: "greedy" });
  const [header, ...rows] = parsed.data;
  if (parsed.errors.length || header?.[0]?.trim() !== firstHeader || header.length < columns ||
      rows.some((row) => row.length < columns || row.slice(columns).some((value) => value.trim()))) malformed(source);
  return rows.map((row) => row.slice(0, columns).map((value) => value.trim().replaceAll("\\r\\n", "\n").replaceAll("\\n", "\n")));
}
