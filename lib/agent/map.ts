import { tool } from "ai";
import { z } from "zod";

export const SHOW_MAP_TOOL_NAME = "show_map";
export const DRAW_ROUTE_TOOL_NAME = "draw_route";
const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export const mapSchema = z.object({
  title: z.string().trim().min(1).max(160),
  pins: z.array(coordinateSchema.extend({
    label: z.string().trim().min(1).max(120),
    description: z.string().max(400).optional(),
  })).max(50),
  routes: z.array(z.object({
    label: z.string().trim().min(1).max(120),
    coordinates: z.array(coordinateSchema).min(2).max(1000).describe("Sourced road geometry for an exact route, or sourced stop coordinates in travel order for a clearly labeled schematic stop connection"),
  })).max(5),
}).refine((map) => map.pins.length > 0 || map.routes.length > 0, "Provide at least one pin or route");
export type AgentMap = z.infer<typeof mapSchema>;
export type MapCoordinate = z.infer<typeof coordinateSchema>;

export const drawRouteSchema = z.object({
  title: z.string().trim().min(1).max(160),
  label: z.string().trim().min(1).max(120).describe("Route label in the user's language, including the travel mode"),
  mode: z.enum(["walking", "cycling", "driving"]),
  waypoints: z.array(coordinateSchema.extend({ label: z.string().trim().min(1).max(120) })).min(2).max(25)
    .describe("Origin, optional stops, destination, in order. Coordinates must come from the user or tool results."),
});

export function mapTools() {
  return {
    [SHOW_MAP_TOOL_NAME]: tool({
      description: "Show a map inline in your reply, with labeled pins and/or route polylines using coordinates from tool results or the user. For bus routes, fetch the ordered stops with the bus tool. Use official route geometry here when available; otherwise use draw_route with mode driving through those stops for an estimated road path, labeled as an estimated driving path through bus stops. Use show_map for stop pins if directions fail, or for a clearly labeled schematic straight connection if the user requests one. Never guess coordinates, stop order or road geometry. This tool displays supplied coordinates; it does not geocode, calculate directions, or snap lines to roads. Write labels and title in the user's language. Pass empty arrays for unused pins or routes.",
      inputSchema: mapSchema,
      execute: async (input) => {
        // Validate here too: stored messages and direct callers may bypass SDK validation.
        const parsed = mapSchema.safeParse(input);
        return parsed.success ? { shown: true } : { shown: false, problems: parsed.error.issues.map((issue) => issue.message) };
      },
    }),
  };
}

/** Web Mercator in world units; clamp only for display, retaining original coordinates. */
export function projectCoordinate({ latitude, longitude }: MapCoordinate) {
  const sin = Math.sin(Math.max(-85.05112878, Math.min(85.05112878, latitude)) * Math.PI / 180);
  return { x: (longitude + 180) / 360, y: Math.max(0, Math.min(1, 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI))) };
}

export const MAP_WIDTH = 640;
export const MAP_HEIGHT = 360;
export const ROUTE_COLORS = ["#38bdf8", "#fb7185", "#4ade80", "#c084fc", "#fbbf24"];

/** Keep nearby points together even when a route crosses the date line. */
export function mapGeometry(map: AgentMap) {
  const all = [...map.pins, ...map.routes.flatMap((route) => route.coordinates)];
  const origin = projectCoordinate(all[0]).x;
  const project = (point: MapCoordinate) => {
    const p = projectCoordinate(point);
    return { x: p.x + Math.round(origin - p.x), y: p.y };
  };
  const points = all.map(project);
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const zoom = Math.max(0, Math.min(15, Math.floor(Math.log2(Math.min((MAP_WIDTH - 96) / (256 * (maxX - minX || 1e-9)), (MAP_HEIGHT - 96) / (256 * (maxY - minY || 1e-9)))))));
  return { project, view: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom } };
}
