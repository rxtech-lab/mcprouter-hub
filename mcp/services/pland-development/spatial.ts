import { UpstreamError } from "@/lib/mcp/fetcher";
import { malformed, page, record } from "@/lib/mcp/spatial";
import { developmentRequest } from "@/lib/mcp/development-spatial";
import type { ResponseTransformer } from "@/lib/mcp/types";

type Contract = {
  label: string;
  oid: string;
  names: Record<string, string>;
  search: string[];
  fields: Record<string, string>;
  geometry: string;
};

export const request = (contract: Contract) => developmentRequest({ ...contract, search: [...contract.search, contract.oid] });

function position(value: unknown): value is number[] {
  return Array.isArray(value) && value.length >= 2 && value.every((n) => typeof n === "number" && Number.isFinite(n)) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}

/** Preserve source nulls, text, units and coordinates. Never emit a truncated polygon. */
export function response(contract: Contract): ResponseTransformer {
  return (body, input) => {
    const bad = () => malformed(contract.label);
    if (!record(body)) return bad();
    if (record(body.error)) throw new UpstreamError("upstream_http", `CSDI ${contract.label} query failed (${String(body.error.code ?? "unknown").slice(0, 20)}): ${String(body.error.message ?? "Check inputs or consult the published dataset.").slice(0, 200)}`);
    if (!Array.isArray(body.features) || body.features.length > Number(input.limit) ||
        (body.exceededTransferLimit !== undefined && typeof body.exceededTransferLimit !== "boolean") ||
        (body.features.length === 0 && body.exceededTransferLimit === true)) return bad();
    if (input.geometry && body.features.length && (!record(body.spatialReference) ||
        (body.spatialReference.wkid !== 4326 && body.spatialReference.latestWkid !== 4326))) return bad();
    const rows = body.features.map((f: unknown) => {
      if (!record(f) || !record(f.attributes)) return bad();
      const attributes = f.attributes;
      if (!Number.isSafeInteger(attributes[contract.oid]) || Number(attributes[contract.oid]) < 1) return bad();
      for (const [field, type] of Object.entries(contract.fields)) {
        if (!(field in attributes)) return bad();
        const value = attributes[field];
        if (value === null) continue;
        if (type === "esriFieldTypeString" ? typeof value !== "string" : typeof value !== "number" || !Number.isFinite(value)) return bad();
      }
      const row: Record<string, unknown> = { ...attributes, name: attributes[contract.names[String(input.lang)]] };
      if (input.geometry) {
        if (!record(f.geometry)) return bad();
        if (contract.geometry === "esriGeometryPoint") {
          if (!position([f.geometry.x, f.geometry.y])) return bad();
        } else if (contract.geometry === "esriGeometryMultipoint") {
          const points = f.geometry.points;
          if (!Array.isArray(points) || !points.length || !points.every(position)) return bad();
        } else if (contract.geometry === "esriGeometryPolyline") {
          const paths = f.geometry.paths;
          if (!Array.isArray(paths) || !paths.length || paths.some((path) => !Array.isArray(path) || path.length < 2 || !path.every(position))) return bad();
        } else {
          const rings = f.geometry.rings;
          if (!Array.isArray(rings) || !rings.length || rings.some((ring) => !Array.isArray(ring) || ring.length < 4 ||
            !ring.every(position) || JSON.stringify(ring[0]) !== JSON.stringify(ring[ring.length - 1]))) return bad();
        }
        if (Buffer.byteLength(JSON.stringify(f.geometry), "utf8") > 20_000) row.geometryOmitted = "Geometry exceeds 20 KB; use the source query URL for the complete geometry.";
        else row.geometry = f.geometry;
      }
      return row;
    });
    return { language: input.lang, coordinateSystem: "WGS84 (longitude, latitude)",
      ...(input.year ? { year: input.year } : {}), ...page(rows, Number(input.offset), Number(input.limit), body.exceededTransferLimit === true) };
  };
}
