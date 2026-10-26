import { readFileSync } from "node:fs";
import manifest from "./fixtures/batch092/manifest.json";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import type { ToolInput } from "@/lib/mcp/types";

export const batch092 = manifest;
export type Entry092 = typeof batch092[number];
export const fixture092 = (c: Entry092) => JSON.parse(readFileSync(new URL(`./fixtures/batch092/${c.file}.json`, import.meta.url), "utf8"));
export function definition092(c: Entry092) {
  const service = services.find((s) => s.id === c.service)!;
  return { service, tool: service.tools.find((t) => t.name === c.tool)! };
}
export function call092(c: Entry092, input: ToolInput = {}) {
  const { service, tool } = definition092(c);
  return executeTool(service, tool, input);
}
export function request092(c: Entry092) {
  const url = new URL(`https://portal.csdi.gov.hk/server/rest/services/common/${c.layer}/FeatureServer/${c.layerId}/query`);
  for (const [k, v] of Object.entries({ f: "json", where: "1=1", outFields: "*", outSR: 4326, orderByFields: "OBJECTID ASC", geometryPrecision: 6, returnGeometry: false, resultRecordCount: 10, resultOffset: 0 })) url.searchParams.set(k, String(v));
  return url.toString();
}
export const cases092 = batch092.map((c) => ({ tool: c.tool, input: {}, request: { url: request092(c) }, reply: fixture092(c),
  data: { language: "en", coordinateSystem: "WGS84 (longitude, latitude)",
    results: fixture092(c).features.map((f: { attributes: Record<string, unknown> }) => ({ ...f.attributes, name: f.attributes[c.names.en] })),
    returned: 2, hasMore: true, nextOffset: 2 }, ttl: 3600 }));
