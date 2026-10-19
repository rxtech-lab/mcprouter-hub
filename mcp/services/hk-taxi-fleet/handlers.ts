import { UpstreamError } from "@/lib/mcp/fetcher";
import type { ResponseTransformer } from "@/lib/mcp/types";

type RawTaxi = {
  veh_id?: string;
  taxi_type?: string;
  passenger_cap?: number;
  lat?: number;
  long?: number;
  time_stamp?: string;
  op_status?: string;
};

const STATUS_LABELS: Record<string, string> = {
  V: "Vacant",
  O: "Occupied",
  N: "Not in service",
};

const TYPE_LABELS: Record<string, string> = {
  O: "Ordinary",
  P: "Premium",
  W: "Wheelchair",
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(6371 * c * 100) / 100;
}

export const normalizeTaxiFleet: ResponseTransformer = (body, input) => {
  if (!body || typeof body !== "object" || !Array.isArray((body as { taxis?: unknown }).taxis)) {
    throw new UpstreamError("upstream_parse", "Expected a JSON object with a taxis array");
  }
  const rawList = (body as { taxis: RawTaxi[] }).taxis;
  const refLat = typeof input.lat === "number" && Number.isFinite(input.lat) ? input.lat : null;
  const refLong = typeof input.long === "number" && Number.isFinite(input.long) ? input.long : null;
  const maxRadius = typeof input.radiusKm === "number" && Number.isFinite(input.radiusKm) ? input.radiusKm : null;

  let taxis = rawList
    .filter((item): item is RawTaxi => Boolean(item && typeof item === "object"))
    .map((item) => {
      const status = String(item.op_status ?? "").toUpperCase();
      const taxiType = String(item.taxi_type ?? "").toUpperCase();
      const hasCoords = refLat !== null && refLong !== null && typeof item.lat === "number" && typeof item.long === "number";
      const distanceKm = hasCoords ? haversineKm(refLat!, refLong!, item.lat!, item.long!) : undefined;
      return {
        ...item,
        op_status: status,
        status_label: STATUS_LABELS[status] ?? status,
        taxi_type: taxiType,
        taxi_type_label: TYPE_LABELS[taxiType] ?? taxiType,
        ...(distanceKm !== undefined ? { distance_km: distanceKm } : {}),
      };
    });

  if (refLat !== null && refLong !== null) {
    if (maxRadius !== null) {
      taxis = taxis.filter((item) => typeof item.distance_km === "number" && item.distance_km <= maxRadius);
    }
    taxis.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
  }

  return { ...(body as object), taxis };
};
