import { readFileSync } from "node:fs";
import manifest from "./fixtures/batch091/manifest.json";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import type { ToolInput } from "@/lib/mcp/types";

export const batch091 = manifest;
export type Entry091 = typeof batch091[number];
export const fixture091 = (c: Entry091) => JSON.parse(readFileSync(new URL(`./fixtures/batch091/${c.file}.json`, import.meta.url), "utf8"));
export function definition091(c: Entry091) {
  const service = services.find((s) => s.id === c.service)!;
  return { service, tool: service.tools.find((t) => t.name === c.tool)! };
}
export function call091(c: Entry091, input: ToolInput = {}) {
  const { service, tool } = definition091(c);
  return executeTool(service, tool, input);
}
export function request091(c: Entry091) {
  const url = new URL(`https://portal.csdi.gov.hk/server/rest/services/common/${c.layer}/FeatureServer/${c.layerId}/query`);
  for (const [k, v] of Object.entries({ f: "json", where: "1=1", outFields: "*", outSR: 4326, orderByFields: "OBJECTID ASC", geometryPrecision: 6, returnGeometry: false, resultRecordCount: 10, resultOffset: 0 })) url.searchParams.set(k, String(v));
  return url.toString();
}
export const cases091 = batch091.map((c) => ({ tool: c.tool, input: {}, request: { url: request091(c) }, reply: fixture091(c),
  data: { language: "en", coordinateSystem: "WGS84 (longitude, latitude)",
    results: fixture091(c).features.map((f: { attributes: Record<string, unknown> }) => ({ ...f.attributes, name: f.attributes[c.names.en] })),
    returned: 2, hasMore: true, nextOffset: 2 }, ttl: 3600 }));
