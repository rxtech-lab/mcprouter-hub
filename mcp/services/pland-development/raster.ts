import { UpstreamError } from "@/lib/mcp/fetcher";
import { malformed, record } from "@/lib/mcp/spatial";
import type { ToolHandler } from "@/lib/mcp/types";
import years from "./raster-years.json";

/** The provider publishes raster MapServers, not FeatureServers, for these grids. */
export const raster: ToolHandler = async (input, { tool, fetchUpstream }) => {
  const year = String(input.year) as keyof typeof years;
  const url = new URL(`${tool.spec.baseUrl}/server/rest/services/common/${years[year]}/MapServer/identify`);
  for (const [key, value] of Object.entries({ f: "json", geometry: `${input.longitude},${input.latitude}`,
    geometryType: "esriGeometryPoint", sr: "4326", layers: "all:0", tolerance: "0",
    mapExtent: "113.8,22.1,114.5,22.6", imageDisplay: "1000,1000,96", returnGeometry: "false" })) url.searchParams.set(key, value);
  const source = url.toString();
  const body = await fetchUpstream(source, { headers: tool.spec.headers });
  const bad = () => malformed("Land utilization raster identify");
  if (!record(body)) return bad();
  if (record(body.error)) throw new UpstreamError("upstream_http", `Raster identify failed (${body.error.code}): ${String(body.error.message).slice(0, 200)}`);
  if (!Array.isArray(body.results) || body.results.length > 1) return bad();
  const results = body.results.map((row: unknown) => {
    if (!record(row) || row.layerId !== 0 || typeof row.layerName !== "string" || row.layerName.length > 256 || !record(row.attributes)) return bad();
    if (Object.keys(row.attributes).length > 16 || Object.entries(row.attributes).some(([key, value]) => key.length > 100 || typeof value !== "string" || value.length > 1000)) return bad();
    const value = row.attributes["Stretch.Pixel Value"] ?? row.attributes["UniqueValue.Pixel Value"];
    // NoData is provider text, not a land-use code of zero.
    if (typeof value !== "string" || !/^(?:[0-9]{1,3}|NoData)$/.test(value)) return bad();
    return { code: value === "NoData" ? null : Number(value), layerName: row.layerName, attributes: row.attributes };
  });
  return { year: input.year, longitude: input.longitude, latitude: input.latitude, source,
    coordinateSystem: "WGS84 (longitude, latitude)", results, returned: results.length,
    note: "Historical broad-brush land utilization; raw raster classification code, not statutory zoning or a parcel-level survey." };
};
