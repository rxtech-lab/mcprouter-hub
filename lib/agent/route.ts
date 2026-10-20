import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { DRAW_ROUTE_TOOL_NAME, drawRouteSchema, mapSchema } from "./map";

const responseSchema = z.object({
  code: z.literal("Ok"),
  routes: z.array(z.object({
    distance: z.number().finite().nonnegative(),
    duration: z.number().finite().nonnegative(),
    geometry: z.object({
      type: z.literal("LineString"),
      coordinates: z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(2).max(1000),
    }),
  })).min(1),
});

/** Server configuration only; the model cannot select the upstream or credentials. */
export function routeTools(options: { baseUrl?: string; token?: string } = {}) {
  return {
    [DRAW_ROUTE_TOOL_NAME]: tool({
      description: "Calculate and draw a road/path route inline using Mapbox Directions, for walking, cycling or driving through 2–25 sourced waypoints. The result is already displayed: do not repeat it with show_map. This sends coordinates to Mapbox. For bus stops without official route geometry, use mode driving through the sourced stops in travel order. Label the title and route line as an estimated driving path through bus stops; briefly explain it may differ from the actual bus path because of bus-only roads and restrictions. Driving duration is not bus travel time. Do not refuse this approximation. For more than 25 stops, use consecutive batches sharing the boundary stop, keeping all intermediate stops, or the requested journey segment. Does not geocode or calculate public transport itineraries or timetables. Ask for missing coordinates/location rather than guessing. Distance is meters and estimated duration is seconds.",
      inputSchema: drawRouteSchema,
      execute: async (input, { abortSignal }) => {
        const parsed = drawRouteSchema.safeParse(input);
        if (!parsed.success) return { shown: false, error: "Provide 2–25 labeled, valid coordinates and a walking, cycling or driving mode." };
        const token = options.token ?? process.env.MAPBOX_DIRECTIONS_ACCESS_TOKEN ?? process.env.MAPBOX_API_KEY ?? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
        if (!token) return { shown: false, error: "Route calculation is unavailable: configure a Mapbox Directions access token. Use show_map for sourced geometry or pins." };
        const { title, label, mode, waypoints } = parsed.data;
        const coordinates = waypoints.map(({ longitude, latitude }) => `${longitude},${latitude}`).join(";");
        const url = new URL(`${options.baseUrl ?? "https://api.mapbox.com"}/directions/v5/mapbox/${mode}/${coordinates}`);
        url.search = new URLSearchParams({ access_token: token, geometries: "geojson", overview: "simplified", steps: "false", alternatives: "false" }).toString();
        try {
          const timeout = AbortSignal.timeout(15_000);
          const response = await fetch(url, { cache: "no-store", signal: abortSignal ? AbortSignal.any([abortSignal, timeout]) : timeout });
          // Never echo provider bodies or fetch exceptions: they may include the token/URL.
          if (!response.ok) return { shown: false, error: `Route provider unavailable (HTTP ${response.status}). Try again later or show known pins.` };
          const body: unknown = await response.json();
          if (body && typeof body === "object" && "code" in body && ["NoRoute", "NoSegment"].includes(String(body.code))) {
            return { shown: false, error: "No route found for these waypoints and travel mode. Show known pins; do not invent a connecting line." };
          }
          const result = responseSchema.safeParse(body);
          if (!result.success) return { shown: false, error: "The provider returned unusable route geometry. Try a shorter route or show known pins." };
          const route = result.data.routes[0];
          const map = mapSchema.parse({ title, pins: waypoints, routes: [{ label, coordinates: route.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })) }] });
          return { shown: true, map, mode, distanceMeters: route.distance, durationSeconds: route.duration, source: "Mapbox Directions" };
        } catch {
          return { shown: false, error: "Route calculation failed or was cancelled. Try again or show known pins." };
        }
      },
    }),
  };
}
