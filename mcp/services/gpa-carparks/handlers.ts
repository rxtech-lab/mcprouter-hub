import type { ToolHandler } from "@/lib/mcp/types";
import { csvDataset } from "@/lib/mcp/csv-dataset";
import { page } from "@/lib/mcp/spatial";

const LANGS: Record<string, [string, string]> = { en: ["ENG", "Car Park Name"], tc: ["TC", "停車場名稱"], sc: ["SC", "停车场名称"] };
const FIELDS = ["name", "district", "address", "vehicleTypes", "spaces", "heightRestrictionMetres", "openingHours", "standardChargers", "standardMediumChargers", "mediumChargers", "quickChargers", "disabledSpaces", "fees", "phone", "website"];

export const carparks: ToolHandler = async (input, context) => {
  const [suffix, header] = LANGS[String(input.lang ?? "en")];
  const source = `https://www.gpa.gov.hk/doc/psi/ds/psi-t-cp_${suffix}.csv`;
  const body = await context.fetchUpstream(source, { format: "text" });
  const rows = csvDataset(body, "GPA car parks CSV", header, FIELDS.length)
    .map((values) => Object.fromEntries(FIELDS.map((field, i) => [field, values[i]])))
    .filter((row) => !input.search || [row.name, row.district, row.address, row.vehicleTypes].some((value) => value.toLowerCase().includes(String(input.search).toLowerCase())));
  const offset = Number(input.offset ?? 0);
  return { ...page(rows.slice(offset), offset, Number(input.limit ?? 20)), total: rows.length, source, language: input.lang ?? "en" };
};
