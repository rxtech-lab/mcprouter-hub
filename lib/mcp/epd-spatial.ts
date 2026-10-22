import { spatialQuery } from "@/lib/mcp/spatial";
import type { ToolHandler } from "@/lib/mcp/types";

/** EPD's CSDI gateway rejects OR-combined text predicates (HTTP 403), although
 * single-field LIKE/UPPER queries work. Expose one allowlisted field per query
 * instead of advertising a cross-field search the live source cannot serve.
 */
export function epdSpatialQuery(dataset: string, fields: readonly string[], names: Record<string, string>): ToolHandler {
  return (input, context) => {
    const field = String(input.searchField ?? names[String(input.lang ?? "en")]);
    if (!fields.includes(field)) throw new Error("Select a published searchField from the tool schema.");
    return spatialQuery(dataset, [field], names)(input, context);
  };
}
