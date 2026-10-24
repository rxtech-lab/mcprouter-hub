import type { ResponseTransformer } from "@/lib/mcp/types";
import { malformed, page, record } from "@/lib/mcp/spatial";
import { UpstreamError } from "@/lib/mcp/fetcher";

const fields = ["NameEN", "NameTC", "AddressEN", "AddressTC", "OpenHoursWeekdayEN", "OpenHoursWeekdayTC", "OpenHoursSatEN", "OpenHoursSatTC", "OpenHoursSunEN", "OpenHoursSunTC", "OpenHoursHolidayEN", "OpenHoursHolidayTC"];
const names: Record<string, string> = {"en": "NameEN", "tc": "NameTC"};
export const features: ResponseTransformer = (body, input) => {
  if (!record(body)) malformed("CSDI hkpost-kiosks");
  if (record(body.error)) throw new UpstreamError("upstream_http", `CSDI query failed (${String(body.error.code).slice(0, 20)}). Check inputs or consult the published dataset.`);
  if (!Array.isArray(body.features) || body.features.length > Number(input.limit) || !record(body.spatialReference) ||
    (body.spatialReference.wkid !== 4326 && body.spatialReference.latestWkid !== 4326)) malformed("CSDI hkpost-kiosks");
  const rows = body.features.map((f: unknown) => {
    if (!record(f) || !record(f.attributes) || !Number.isSafeInteger(f.attributes.OBJECTID) ||
      !fields.every((k) => typeof (f.attributes as Record<string, unknown>)[k] === "string" || (f.attributes as Record<string, unknown>)[k] === null) ||
      !record(f.geometry) || typeof f.geometry.x !== "number" || typeof f.geometry.y !== "number" ||
      !Number.isFinite(f.geometry.x) || !Number.isFinite(f.geometry.y) || Math.abs(f.geometry.x) > 180 || Math.abs(f.geometry.y) > 90) malformed("CSDI hkpost-kiosks");
    return { ...f.attributes, name: f.attributes[names[String(input.lang)]], geometry: f.geometry };
  });
  return { language: input.lang, coordinateSystem: "WGS84 (longitude, latitude)",
    ...page(rows, Number(input.offset), Number(input.limit), body.exceededTransferLimit === true) };
};
