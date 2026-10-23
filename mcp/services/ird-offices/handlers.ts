import { spatialQuery, record, malformed } from "@/lib/mcp/spatial";
import type { ToolHandler } from "@/lib/mcp/types";

const read = spatialQuery("ird_rcd_1668166144542_67785", ["NAME_EN", "NAME_TC", "ADDRESS_EN", "ADDRESS_TC"], {"en": "NAME_EN", "tc": "NAME_TC"});
export const query: ToolHandler = async (input, context) => {
  const result = await read(input, context) as { results: unknown[] };
  for (const row of result.results) {
    if (!record(row) || !Number.isSafeInteger(row.OBJECTID) || typeof row.NAME_EN !== "string" || typeof row.NAME_TC !== "string" ||
      (input.geometry !== false && (!record(row.geometry) || typeof row.geometry.x !== "number" || typeof row.geometry.y !== "number" ||
        !Number.isFinite(row.geometry.x) || !Number.isFinite(row.geometry.y) || Math.abs(row.geometry.x) > 180 || Math.abs(row.geometry.y) > 90))) malformed("Offices of Inland Revenue Department");
  }
  return result;
};
