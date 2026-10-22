import { readFileSync } from "node:fs";
import { services } from "@/generated/registry";
import manifest from "./fixtures/environment022/manifest.json";
import type { ToolInput } from "@/lib/mcp/types";

export const entries022 = manifest;
export const fixture022 = (file: string) => JSON.parse(readFileSync(new URL(`./fixtures/environment022/${file}`, import.meta.url), "utf8"));
export function definition022(name: string) {
  const service = services.find((s) => s.tools.some((t) => t.name === name))!;
  return { service, tool: service.tools.find((t) => t.name === name)! };
}
export const cases022 = manifest.flatMap((entry) => {
  const layers = entry.habitats ?? [{ id: 0, name: "default", objectIdField: "OBJECTID", fields: { report: "", district: "", habitat: "" } }];
  return layers.map((layer) => {
    const file = `${entry.id}${layer.id ? `-${layer.id}` : ""}.json`;
    const reply = fixture022(file);
    const nameField = entry.habitats ? layer.fields.report : entry.names.en;
    const input: ToolInput = { limit: 2, ...(entry.habitats ? { habitat: layer.name } : {}) };
    const url = `https://portal.csdi.gov.hk/server/rest/services/common/${entry.layer}/FeatureServer/${layer.id}/query?f=json&where=1%3D1&outFields=*&outSR=4326&returnGeometry=false&resultRecordCount=2&resultOffset=0&orderByFields=${layer.objectIdField}+ASC&geometryPrecision=6`;
    const results = reply.features.map((feature: { attributes: Record<string, unknown> }) => {
      const attributes = Object.fromEntries(Object.entries(feature.attributes).filter(([, value]) => value !== null));
      return { ...attributes, ...(attributes[nameField] ? { name: attributes[nameField] } : {}) };
    });
    return { ...entry, sublayer: layer, file, input, reply, request: { url },
      data: { results, returned: results.length, hasMore: reply.exceededTransferLimit === true,
        nextOffset: reply.exceededTransferLimit === true ? results.length : null,
        source: url, coordinateSystem: "WGS84 (longitude, latitude)" } };
  });
});
