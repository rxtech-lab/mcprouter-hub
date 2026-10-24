import { readFileSync } from "node:fs";
import manifest from "./fixtures/batch079/manifest.json";
import type { Case } from "./tool-case";
import type { ToolInput } from "@/lib/mcp/types";

export const batch079 = manifest;
export type Entry079 = typeof batch079[number];
export function fixture079(file: string, layer = 0) {
  return JSON.parse(readFileSync(new URL(`./fixtures/batch079/${file}-${layer}.json`, import.meta.url), "utf8")) as {
    features: { attributes: Record<string, unknown>; geometry: Record<string, unknown> }[];
    exceededTransferLimit?: boolean;
    spatialReference: { wkid: number };
  };
}
export function layer079(c: Entry079, input: ToolInput = {}) {
  return c.file === "2031" ? ({ "1999": 2, "2003": 0, "2007": 1, "2015": 3 }[String(input.year ?? "2015")] ?? 3) : 0;
}
export function request079(c: Entry079, input: ToolInput = {}, base = "https://portal.csdi.gov.hk") {
  const q = new URLSearchParams({ f: "json", where: "1=1", outFields: "*", outSR: "4326", orderByFields: `${c.oid} ASC`, geometryPrecision: "6",
    returnGeometry: String(input.geometry ?? true), resultRecordCount: String(input.limit ?? 20), resultOffset: String(input.offset ?? 0) });
  return `${base}/server/rest/services/common/${c.layer}/FeatureServer/${layer079(c, input)}/query?${q}`;
}
export function expected079(c: Entry079, input: ToolInput = {}) {
  const body = fixture079(c.file, layer079(c, input));
  const lang = String(input.lang ?? "en");
  const field = c.file === "2031" && layer079(c, input) === 3 ? (lang === "en" ? "NAME_EN" : "NAME_TC") : c.names[lang as keyof typeof c.names]!;
  const results = body.features.map((f) => ({ ...f.attributes, name: f.attributes[field],
    ...(input.geometry === false ? {} : Buffer.byteLength(JSON.stringify(f.geometry), "utf8") > 20_000 ? { geometryOmitted: "Geometry exceeds 20 KB; use the source query URL for the complete geometry." } : { geometry: f.geometry }) }));
  return { language: lang, coordinateSystem: "WGS84 (longitude, latitude)", ...(c.file === "2031" ? { year: String(input.year ?? "2015") } : {}),
    results, returned: results.length, hasMore: body.exceededTransferLimit === true, nextOffset: body.exceededTransferLimit === true ? Number(input.offset ?? 0) + results.length : null };
}
export const cases079: Case[] = batch079.map((c) => ({ tool: c.tool, input: {}, reply: fixture079(c.file, layer079(c)), request: { url: request079(c) }, ttl: 3600, data: expected079(c) }));
