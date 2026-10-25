import { readFileSync } from "node:fs";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import type { ToolInput } from "@/lib/mcp/types";
import manifest from "./fixtures/batch088/manifest.json";

export const batch088 = manifest;
export type Entry088 = typeof manifest[number];
export const fixture088 = (c: Entry088) => JSON.parse(readFileSync(new URL(`./fixtures/batch088/${c.file}.json`, import.meta.url), "utf8"));
export function definition088(name: string) {
  const service = services.find((s) => s.id === "pland-development")!;
  return { service, tool: service.tools.find((t) => t.name === name)! };
}
export function call088(name: string, input: ToolInput = {}) {
  const { service, tool } = definition088(name);
  return executeTool(service, tool, input);
}
export function request088(c: Entry088) {
  const url = new URL(c.baseUrl + c.path);
  for (const [key, value] of Object.entries({ f: "json", where: "1=1", outFields: "*", outSR: 4326, orderByFields: "OBJECTID ASC", geometryPrecision: 6, returnGeometry: true, resultRecordCount: 20, resultOffset: 0 })) url.searchParams.set(key, String(value));
  return url.toString();
}

export const cases088 = batch088.map((c) => ({ tool: c.tool, input: {}, request: { url: request088(c) }, reply: fixture088(c),
  data: { language: "en", coordinateSystem: "WGS84 (longitude, latitude)", results: fixture088(c).features.map((f: { attributes: Record<string, unknown>; geometry: unknown }) => ({ ...f.attributes, name: f.attributes[c.names.en],
    ...(Buffer.byteLength(JSON.stringify(f.geometry)) > 20000 ? { geometryOmitted: "Geometry exceeds 20 KB; use the source query URL for the complete geometry." } : { geometry: f.geometry }) })),
    returned: fixture088(c).features.length, hasMore: fixture088(c).exceededTransferLimit === true, nextOffset: fixture088(c).exceededTransferLimit === true ? fixture088(c).features.length : null }, ttl: 3600 }));
