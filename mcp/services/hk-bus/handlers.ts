import type { ResponseTransformer } from "@/lib/mcp/types";

/**
 * KMB and Citybus route-stop feeds only carry stop ids. These transformers
 * join in each stop's names and coordinates so callers (and the app) can show
 * where the bus stops without a second round of tool calls.
 */

type Stop = { stop: string; name_en?: string; name_tc?: string; name_sc?: string; lat?: string; long?: string };
type RouteStop = Record<string, unknown> & { stop: string };

const STOP_TTL = 86_400;

function withStop(item: RouteStop, stop: Stop | undefined): RouteStop {
  if (!stop) return item;
  return { ...item, name_en: stop.name_en, name_tc: stop.name_tc, name_sc: stop.name_sc, lat: stop.lat, long: stop.long };
}

function routeStops(body: unknown): RouteStop[] {
  const data = (body as { data?: unknown })?.data;
  return Array.isArray(data) ? (data as RouteStop[]) : [];
}

/** KMB publishes every stop in one list, cached for a day, so one lookup covers the whole route. */
export const kmbRouteStopNames: ResponseTransformer = async (body, _input, context) => {
  const list = routeStops(body);
  if (!list.length) return body;
  try {
    const all = (await context.fetchUpstream("https://data.etabus.gov.hk/v1/transport/kmb/stop", { cacheTtl: STOP_TTL })) as { data?: Stop[] };
    const byId = new Map((all.data ?? []).map((stop) => [stop.stop, stop]));
    return { ...(body as object), data: list.map((item) => withStop(item, byId.get(item.stop))) };
  } catch {
    // Names are a nicety; the stop ids alone still answer the question.
    return body;
  }
};

/** Citybus has no bulk stop list, so each stop is looked up (and cached) on its own. */
export const citybusRouteStopNames: ResponseTransformer = async (body, _input, context) => {
  const list = routeStops(body);
  if (!list.length) return body;
  const stops = await Promise.all(
    list.map(async (item) => {
      try {
        const result = (await context.fetchUpstream(`https://rt.data.gov.hk/v2/transport/citybus/stop/${encodeURIComponent(item.stop)}`, { cacheTtl: STOP_TTL })) as { data?: Stop };
        return result.data;
      } catch {
        return undefined;
      }
    }),
  );
  return { ...(body as object), data: list.map((item, index) => withStop(item, stops[index])) };
};
