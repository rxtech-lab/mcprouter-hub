import { csvDataset } from "@/lib/mcp/csv-dataset";
import { page } from "@/lib/mcp/spatial";
import type { ToolHandler } from "@/lib/mcp/types";

/** The published CSV carries all three languages, including fax omitted from CSDI. */
export const clothes: ToolHandler = async (input, context) => {
  const source = "https://www.had.gov.hk/psi/community-used-clothes-recycling-banks/community_used_clothes_recycling_banks.csv";
  const rows = csvDataset(await context.fetchUpstream(source, { format: "text" }), "HAD clothes banks", "District", 17);
  const language = { en: 0, tc: 1, sc: 2 }[String(input.lang ?? "en")] ?? 0;
  const needle = String(input.search ?? "").trim().toLowerCase();
  const results = rows.filter((row) => !needle || row.some((value) => value.toLowerCase().includes(needle)))
    .map((row) => ({ district: row[language], region: row[3 + language], address: row[6 + language],
      schemeManager: row[9 + language], telephone: row[12], fax: row[13], managerAddress: row[14 + language] }));
  const offset = Number(input.offset ?? 0);
  return { ...page(results.slice(offset), offset, Number(input.limit ?? 20)), source };
};
