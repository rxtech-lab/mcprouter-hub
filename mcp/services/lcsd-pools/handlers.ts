import { spatialQuery, record, malformed } from "@/lib/mcp/spatial";
import type { ToolHandler } from "@/lib/mcp/types";

const read = spatialQuery("lcsd_rcd_1634540558875_77434", ["NameEN", "NameTC", "AddressEN", "AddressTC", "DistrictEN", "DistrictTC"], {"en": "NameEN", "tc": "NameTC"});
export const query: ToolHandler = async (input, context) => {
  const result = await read(input, context) as { results: unknown[] };
  for (const row of result.results) {
    if (!record(row) || !Number.isSafeInteger(row.OBJECTID) || typeof row.NameEN !== "string" || typeof row.NameTC !== "string" ||
      (input.geometry !== false && (!record(row.geometry) || typeof row.geometry.x !== "number" || typeof row.geometry.y !== "number" ||
        !Number.isFinite(row.geometry.x) || !Number.isFinite(row.geometry.y) || Math.abs(row.geometry.x) > 180 || Math.abs(row.geometry.y) > 90))) malformed("Public swimming pools, facilities and opening hours");
  }
  return result;
};
