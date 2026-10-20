import { afterEach, describe, expect, it, vi } from "vitest";
import { drawRouteSchema, mapSchema } from "@/lib/agent/map";
import { routeTools } from "@/lib/agent/route";

const input = {
  title: "Walk to the pier", label: "Walking route", mode: "walking" as const,
  waypoints: [{ label: "Start", latitude: 22.286, longitude: 114.158 }, { label: "Pier", latitude: 22.294, longitude: 114.168 }],
};
const context = { toolCallId: "route", messages: [], context: {} };
afterEach(() => vi.unstubAllEnvs());

it("rejects unsupported travel modes, invalid coordinates and waypoint counts", () => {
  for (const value of [
    { ...input, mode: "bus" }, { ...input, waypoints: input.waypoints.slice(0, 1) },
    { ...input, waypoints: Array(26).fill(input.waypoints[0]) },
    { ...input, waypoints: [{ ...input.waypoints[0], latitude: 91 }, input.waypoints[1]] },
  ]) expect(drawRouteSchema.safeParse(value).success).toBe(false);
});

it("validates direct calls and reports missing configuration without calling upstream", async () => {
  const tool = routeTools({ token: "" }).draw_route;
  expect(await tool.execute!({ ...input, mode: "bus" } as never, context)).toMatchObject({ shown: false });
  expect(await tool.execute!(input, context)).toMatchObject({ shown: false, error: expect.stringContaining("access token") });
});

// Real fetch requests against the checked-in Postman simulation; no HTTP stubs.
describe.skipIf(!process.env.ROUTE_SIMULATION_URL)("Directions HTTP integration", () => {
  const tool = routeTools({ baseUrl: process.env.ROUTE_SIMULATION_URL, token: "simulation-only" }).draw_route;
  it("preserves pin order and displays provider geometry, distance and duration", async () => {
    const result = await tool.execute!(input, context);
    expect(result).toMatchObject({ shown: true, mode: "walking", distanceMeters: 1200, durationSeconds: 900 });
    if ("map" in result && result.map) {
      expect(mapSchema.safeParse(result.map).success).toBe(true);
      expect(result.map.pins).toEqual(input.waypoints);
      expect(result.map.routes[0].coordinates).toEqual([
        { latitude: 22.286, longitude: 114.158 }, { latitude: 22.287, longitude: 114.159 }, { latitude: 22.294, longitude: 114.168 },
      ]);
    }
  });
  it("handles no route, provider HTML errors and invalid geometry without invented lines", async () => {
    for (const value of [
      { ...input, mode: "cycling" as const }, { ...input, mode: "driving" as const },
      { ...input, waypoints: [{ ...input.waypoints[0], longitude: 0 }, input.waypoints[1]] },
    ]) {
      const result = await tool.execute!(value, context);
      expect(result).toMatchObject({ shown: false, error: expect.any(String) });
      expect(result).not.toHaveProperty("map");
      expect(JSON.stringify(result)).not.toContain("simulation-only");
    }
  });
  it("honors cancellation without leaking credentials", async () => {
    const result = await tool.execute!(input, { ...context, abortSignal: AbortSignal.abort() });
    expect(result).toMatchObject({ shown: false, error: expect.stringContaining("cancelled") });
    expect(JSON.stringify(result)).not.toContain("simulation-only");
  });
});
