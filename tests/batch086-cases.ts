import { readFileSync } from "node:fs";
import manifest from "./fixtures/batch086/manifest.json";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import type { ToolInput } from "@/lib/mcp/types";

export const batch086 = manifest;
export type Entry086 = typeof batch086[number];
export const fixture086 = (c: Entry086) => JSON.parse(readFileSync(new URL(`./fixtures/batch086/${c.file}.json`, import.meta.url), "utf8"));
export function definition086(c: Entry086) {
  const service = services.find((s) => s.id === c.service)!;
  return { service, tool: service.tools.find((t) => t.name === c.tool)! };
}
export function call086(c: Entry086, input: ToolInput = {}) {
  const { service, tool } = definition086(c);
  return executeTool(service, tool, input);
}
export function request086(c: Entry086) {
  const url = new URL(`https://portal.csdi.gov.hk/server/rest/services/common/${c.layer}/FeatureServer/0/query`);
  for (const [k, v] of Object.entries({ f: "json", where: "1=1", outFields: "*", outSR: 4326, orderByFields: "OBJECTID ASC", geometryPrecision: 6, returnGeometry: true, resultRecordCount: 20, resultOffset: 0 })) url.searchParams.set(k, String(v));
  return url.toString();
}

// Central tool runner reuses the same unmodified official captures.
export const cases086 = [
  ...batch086.map((c) => ({ tool: c.tool, input: {}, request: { url: request086(c) }, reply: fixture086(c),
    data: { language: "en", coordinateSystem: "WGS84 (longitude, latitude)",
      results: fixture086(c).features.map((f: { attributes: Record<string, unknown>; geometry: unknown }) => ({ ...f.attributes, name: f.attributes[c.names.en],
        ...(Buffer.byteLength(JSON.stringify(f.geometry)) > 20000 ? { geometryOmitted: "Geometry exceeds 20 KB; use the source query URL for the complete geometry." } : { geometry: f.geometry }) })),
      returned: 2, hasMore: true, nextOffset: 2 }, ttl: 3600 })),
  { tool: "landsd_satref_nmea_snapshot", input: { station: "invalid" }, error: /Invalid/ },
  { tool: "landsd_satref_rinex_header", input: { year: 2026, day: 366 }, error: /days/ },
];
