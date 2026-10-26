import { readFileSync } from "node:fs";
import manifest from "./fixtures/batch090/manifest.json";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import type { ToolInput } from "@/lib/mcp/types";

export const batch090 = manifest;
export type Entry090 = typeof batch090[number];
export const fixture090 = (c: Entry090) => JSON.parse(readFileSync(new URL(`./fixtures/batch090/${c.file}.json`, import.meta.url), "utf8"));
export function definition090(c: Entry090) {
  const service = services.find((s) => s.id === c.service)!;
  return { service, tool: service.tools.find((t) => t.name === c.tool)! };
}
export function call090(c: Entry090, input: ToolInput = {}) {
  const { service, tool } = definition090(c);
  return executeTool(service, tool, input);
}
export function request090(c: Entry090) {
  const url = new URL(`https://portal.csdi.gov.hk/server/rest/services/common/${c.layer}/FeatureServer/0/query`);
  for (const [k, v] of Object.entries({ f: "json", where: "1=1", outFields: "*", outSR: 4326, orderByFields: "OBJECTID ASC", geometryPrecision: 6, returnGeometry: false, resultRecordCount: 10, resultOffset: 0 })) url.searchParams.set(k, String(v));
  return url.toString();
}
export const cases090 = batch090.map((c) => ({ tool: c.tool, input: {}, request: { url: request090(c) }, reply: fixture090(c),
  data: { language: "en", coordinateSystem: "WGS84 (longitude, latitude)",
    results: fixture090(c).features.map((f: { attributes: Record<string, unknown> }) => ({ ...f.attributes, name: f.attributes[c.names.en] })),
    returned: 2, hasMore: true, nextOffset: 2 }, ttl: 3600 }));
