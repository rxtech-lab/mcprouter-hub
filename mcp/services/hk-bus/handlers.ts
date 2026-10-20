import { malformed, page, record } from "@/lib/mcp/spatial";
import type { HandlerContext, RequestTransformer, ResponseTransformer, ToolHandler } from "@/lib/mcp/types";

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

/** NLB spells its languages `_e`, `_c` and `_s`; rename them so search, cards and the app read `_en`, `_tc` and `_sc` like the other operators. */
export const nlbNames: ResponseTransformer = (body) => {
  if (!body || typeof body !== "object") return body;
  const rename = (item: unknown) =>
    item && typeof item === "object"
      ? Object.fromEntries(Object.entries(item).map(([key, value]) => [key.replace(/_([ecs])$/, (_, code: string) => ({ e: "_en", c: "_tc", s: "_sc" })[code]!), value]))
      : item;
  return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, Array.isArray(value) ? value.map(rename) : value]));
};

// Hong Kong Tramways publishes routes and stops as one CSV per language, with the same rows in the same order
// and the column headers translated. Read the columns by position and join the three files row by row.

const TRAM_DATA = "https://static.data.gov.hk/tramways/datasets";
const TRAM_LANGS = ["en", "tc", "sc"] as const;

async function tramCsv(file: string, context: HandlerContext): Promise<string[][][]> {
  return Promise.all(
    TRAM_LANGS.map(async (lang) => {
      const rows = (await context.fetchUpstream(`${TRAM_DATA}/${file}_${lang}.csv`, { format: "csv", cacheTtl: STOP_TTL })) as Record<string, string>[];
      return rows.map((row) => Object.values(row).map((value) => String(value ?? "").trim()));
    }),
  );
}

export const tramRoutes: ToolHandler = async (_input, context) => {
  const [en, tc, sc] = await tramCsv("main_routes/tramways_main_routes", context);
  return en.map(([route, orig, dest], index) => ({
    route,
    orig_en: orig,
    orig_tc: tc[index]?.[1],
    orig_sc: sc[index]?.[1],
    dest_en: dest,
    dest_tc: tc[index]?.[2],
    dest_sc: sc[index]?.[2],
  }));
};

export const tramStops: ToolHandler = async (_input, context) => {
  const [en, tc, sc] = await tramCsv("tram_stops/summary_tram_stops", context);
  return en.map(([direction, stop, name], index) => ({
    direction: direction.toLowerCase(),
    stop,
    name_en: name,
    name_tc: tc[index]?.[2],
    name_sc: sc[index]?.[2],
  }));
};


export const validateStop: RequestTransformer = (request, input) => {
  if (input.operator === "CTB" && !/^[0-9]{6}$/.test(String(input.stopId))) {
    throw new Error("Citybus stopId must contain exactly six digits, e.g. 001001.");
  }
  return request;
};

export const batch: ResponseTransformer = (body, input) => {
  if (!record(body) || !Array.isArray(body.data) || typeof body.generated_timestamp !== "string" ||
      body.data.some((row) => !record(row) || typeof row.co !== "string" || typeof row.stop !== "string")) malformed("DPO bus batch");
  const offset = Number(input.offset ?? 0);
  return { ...page(body.data.slice(offset), offset, Number(input.limit ?? 200)), total: body.data.length, generatedAt: body.generated_timestamp };
};
