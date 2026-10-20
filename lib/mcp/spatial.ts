import { UpstreamError } from "@/lib/mcp/fetcher";
import type { ToolHandler } from "@/lib/mcp/types";

type RecordValue = Record<string, unknown>;
export function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function malformed(source: string): never {
  throw new UpstreamError("upstream_parse", `${source} returned an unexpected dataset format; retry later or check the published resource.`);
}

/** Bound both the number of records and serialized size, without silently losing a page. */
export function page(rows: unknown[], offset: number, limit: number, upstreamHasMore = false) {
  const results: unknown[] = [];
  let size = 0;
  for (const row of rows.slice(0, limit)) {
    const bytes = Buffer.byteLength(JSON.stringify(row), "utf8");
    if (size + bytes > 100_000) {
      if (!results.length) throw new UpstreamError("upstream_parse", "An upstream record exceeds the 100 KB output limit; narrow the query or omit geometry.");
      break;
    }
    results.push(row);
    size += bytes;
  }
  const hasMore = upstreamHasMore || results.length < rows.length;
  return { results, returned: results.length, hasMore, nextOffset: hasMore ? offset + results.length : null };
}

/** Read-only ArcGIS queries: no caller-supplied URL, layer, SQL or field names. */
export function spatialQuery(dataset: string, searchFields: readonly string[], nameFields?: Record<string, string>): ToolHandler {
  return async (input, context) => {
    const url = new URL(`https://portal.csdi.gov.hk/server/rest/services/common/${dataset}/FeatureServer/0/query`);
    const limit = Number(input.limit ?? 20);
    const offset = Number(input.offset ?? 0);
    const where = ["1=1"];
    if (input.objectId !== undefined) where.push(`OBJECTID=${Number(input.objectId)}`);
    if (typeof input.search === "string" && input.search.trim()) {
      const term = input.search.trim().replaceAll("'", "''").toUpperCase();
      where.push(`(${searchFields.map((field) => `UPPER(${field}) LIKE '%${term}%'`).join(" OR ")})`);
    }
    const params: Record<string, string> = {
      f: "json", where: where.join(" AND "), outFields: "*", outSR: "4326",
      returnGeometry: String(input.geometry ?? true), resultRecordCount: String(limit),
      resultOffset: String(offset), orderByFields: "OBJECTID ASC", geometryPrecision: "6",
    };
    if (input.bbox !== undefined) {
      const bounds = String(input.bbox).split(",").map(Number);
      if (bounds.length !== 4 || bounds.some((v) => !Number.isFinite(v)) ||
          bounds[0] < -180 || bounds[2] > 180 || bounds[1] < -90 || bounds[3] > 90 ||
          bounds[0] >= bounds[2] || bounds[1] >= bounds[3]) {
        throw new Error("bbox must be west,south,east,north in WGS84 degrees, with west < east and south < north.");
      }
      Object.assign(params, { geometry: bounds.join(","), geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects" });
    }
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const body = await context.fetchUpstream(url.toString());
    if (!record(body)) malformed(dataset);
    if (record(body.error)) throw new UpstreamError("upstream_http", `CSDI query failed (${body.error.code ?? "unknown"}): ${String(body.error.message ?? "Retry later").slice(0, 200)}`);
    if (!Array.isArray(body.features)) malformed(dataset);
    const rows = body.features.map((feature: unknown) => {
      if (!record(feature) || !record(feature.attributes)) malformed(dataset);
      const attributes = Object.fromEntries(Object.entries(feature.attributes).filter(([, value]) => value !== null));
      const name = nameFields ? attributes[nameFields[String(input.lang ?? "en")]] : undefined;
      const result: RecordValue = { ...attributes, ...(name ? { name } : {}) };
      if (input.geometry !== false && feature.geometry != null) {
        if (!record(feature.geometry)) malformed(dataset);
        // Large polylines remain available by id at the source; never return a misleading partial line.
        if (JSON.stringify(feature.geometry).length > 20_000) result.geometryOmitted = "Geometry exceeds 20,000 characters; use the source URL.";
        else result.geometry = feature.geometry;
      }
      return result;
    });
    return { ...page(rows, offset, limit, body.exceededTransferLimit === true), source: url.toString(), coordinateSystem: "WGS84 (longitude, latitude)" };
  };
}
