import { readFileSync } from "node:fs";
import { services } from "@/generated/registry";
import manifest from "./fixtures/environment023/manifest.json";
import type { ToolInput } from "@/lib/mcp/types";
export const entries023 = manifest;
export const fixture023 = (file: string) => readFileSync(new URL(`./fixtures/environment023/${file}`, import.meta.url), "utf8");
export function definition023(name: string) {
  const service = services.find((s) => s.tools.some((t) => t.name === name))!;
  return { service, tool: service.tools.find((t) => t.name === name)! };
}
export const spatialCases023 = manifest.filter((e) => e.kind === "spatial").map((entry) => {
  const file = `${entry.id}.json`;
  const reply = JSON.parse(fixture023(file));
  const input: ToolInput = { limit: 2 };
  const url = `https://portal.csdi.gov.hk/server/rest/services/common/${entry.layer}/FeatureServer/0/query?f=json&where=1%3D1&outFields=*&outSR=4326&returnGeometry=false&resultRecordCount=2&resultOffset=0&orderByFields=OBJECTID+ASC&geometryPrecision=6`;
  const results = reply.features.map((feature: { attributes: Record<string, unknown> }) => {
    const attributes = Object.fromEntries(Object.entries(feature.attributes).filter(([, value]) => value !== null));
    return { ...attributes, ...(attributes[entry.names!.en!] ? { name: attributes[entry.names!.en!] } : {}) };
  });
  return { ...entry, names: entry.names!, fields: entry.fields!, sublayer: { objectIdField: "OBJECTID" }, file, input, reply, request: { url },
    data: { results, returned: results.length, hasMore: reply.exceededTransferLimit === true, nextOffset: reply.exceededTransferLimit === true ? results.length : null, source: url, coordinateSystem: "WGS84 (longitude, latitude)" } };
});
export const fileCases023 = manifest.filter((e) => e.kind !== "spatial").flatMap((entry) => ["en", "tc", "sc"].map((lang) => {
  const file = `${entry.id}-${entry.kind === "clothes" ? "en" : lang}.${entry.kind === "daily" ? "json" : "csv"}`;
  const reply = fixture023(file);
  const input: ToolInput = { lang, limit: 2, ...(entry.kind === "daily" ? { date: "20261021" } : {}) };
  const url = entry.kind === "clothes" ? entry.url! : entry.kind === "daily" ? entry.url!.replace("lang=en", `lang=${lang}`) : entry.url!.replace(".csv", `${lang === "tc" ? "_uc" : lang === "sc" ? "_sc" : ""}.csv`);
  return { ...entry, lang, file, reply, input, request: { url } };
}));
