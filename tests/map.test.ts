import { describe, expect, it } from "vitest";
import { MAP_HEIGHT, MAP_WIDTH, mapGeometry, mapSchema, mapTools, projectCoordinate, type AgentMap } from "@/lib/agent/map";

const map: AgentMap = {
  title: "Harbour crossing",
  pins: [{ label: "Central", latitude: 22.286, longitude: 114.158 }, { label: "Tsim Sha Tsui", latitude: 22.294, longitude: 114.168 }],
  routes: [{ label: "Ferry", coordinates: [{ latitude: 22.286, longitude: 114.158 }, { latitude: 22.29, longitude: 114.16 }, { latitude: 22.294, longitude: 114.168 }] }],
};

describe("show_map", () => {
  it("accepts pins only, routes only, and both, and returns display acknowledgement", async () => {
    for (const input of [map, { ...map, routes: [] }, { ...map, pins: [] }]) {
      expect(mapSchema.safeParse(input).success).toBe(true);
      expect(await mapTools().show_map.execute!(input, { toolCallId: "map", messages: [] } as never)).toEqual({ shown: true });
    }
  });

  it("rejects empty maps, invalid coordinates, missing labels, oversized inputs and one-point routes", () => {
    for (const input of [
      { ...map, pins: [], routes: [] },
      { ...map, pins: [{ label: "x", latitude: 91, longitude: 0 }] },
      { ...map, pins: [{ label: "x", latitude: 0, longitude: -181 }] },
      { ...map, pins: [{ latitude: 0, longitude: 0 }] },
      { ...map, pins: Array(51).fill(map.pins[0]) },
      { ...map, routes: [{ label: "x", coordinates: [map.pins[0]] }] },
      { ...map, routes: [{ label: "x", coordinates: Array(1001).fill(map.pins[0]) }] },
    ]) expect(mapSchema.safeParse(input).success).toBe(false);
  });
});

describe("map geometry", () => {
  it("fits every coordinate inside the viewport with padding", () => {
    const geometry = mapGeometry(map);
    const scale = 256 * 2 ** geometry.view.zoom;
    for (const point of [...map.pins, ...map.routes.flatMap((route) => route.coordinates)]) {
      const p = geometry.project(point);
      expect(Math.abs(p.x - geometry.view.x) * scale).toBeLessThan(MAP_WIDTH / 2 - 40);
      expect(Math.abs(p.y - geometry.view.y) * scale).toBeLessThan(MAP_HEIGHT / 2 - 40);
    }
  });

  it("keeps a single pin and polar coordinates finite", () => {
    expect(mapGeometry({ ...map, pins: [map.pins[0]], routes: [] }).view.zoom).toBe(15);
    expect(projectCoordinate({ latitude: 90, longitude: 180 })).toEqual({ x: 1, y: 0 });
    expect(projectCoordinate({ latitude: -90, longitude: -180 })).toEqual({ x: 0, y: 1 });
  });

  it("fits nearby pins across the date line together", () => {
    const geometry = mapGeometry({ title: "Date line", routes: [], pins: [{ label: "West", latitude: 0, longitude: 179.9 }, { label: "East", latitude: 0, longitude: -179.9 }] });
    expect(geometry.view.zoom).toBeGreaterThan(9);
  });
});
