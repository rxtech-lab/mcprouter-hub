import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import manifest from "@/generated/manifest.json";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";

const service = services.find((s) => s.id === "landsd-topographic")!;
const tool = service.tools[0];
const args = { sr: "HK80", z: 11, x: 287, y: 385 };
const png = readFileSync(new URL("./fixtures/batch085/3081.png", import.meta.url));
const fetchMock = vi.fn<typeof fetch>();
const call = (input = args) => executeTool(service, tool, input);
beforeEach(() => {
  const store = new Map<string, unknown>();
  setCacheForTesting({ get: async (k) => store.get(k) ?? null, set: async (k, v) => void store.set(k, v), delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); setCacheForTesting(null); });
it("API-3081 registers its dataset and validates/caches the captured real tile", async () => {
  expect(service.apis).toEqual(["API-3081"]);
  expect((manifest.datasets as Record<string, string[]>)["hk-landsd-openmap-landsd-topo-map-api"]).toEqual([service.id]);
  fetchMock.mockResolvedValueOnce(new Response(png, { headers: { "content-type": "image/png" } }));
  const first = await call();
  expect(first.data).toMatchObject({ available: true, width: 256, height: 256, bytes: png.length, sha256: createHash("sha256").update(png).digest("hex"), spatialReference: "HK80", zoom: 11, x: 287, y: 385, attribution: expect.stringContaining("Lands Department") });
  expect((await call()).data).toEqual(first.data); expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.lastCall![0]).toBe("https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/HK80/11/287/385.png");
});
it("rejects malformed tile inputs before fetching", async () => {
  for (const patch of [{ z: 9 }, { z: 21 }, { z: 10.5 }, { x: -1 }, { x: 16777216 }, { y: 1.5 }, { y: -1 }, { sr: "EPSG:4326" }]) await expect(call({ ...args, ...patch })).rejects.toThrow();
  await expect(executeTool(service, tool, {})).rejects.toThrow(); expect(fetchMock).not.toHaveBeenCalled();
});
it("reports a missing tile explicitly", async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
  expect((await call()).data).toMatchObject({ available: false, reason: expect.stringContaining("No tile") });
});
it("rejects HTML, corrupt and oversized PNG responses without caching failures", async () => {
  for (const response of [new Response("maintenance"), new Response("not png", { headers: { "content-type": "image/png" } }), new Response(png, { headers: { "content-type": "image/png", "content-length": "1048577" } }), new Response(new Uint8Array(1048577), { headers: { "content-type": "image/png" } })]) {
    fetchMock.mockResolvedValueOnce(response); await expect(call()).rejects.toMatchObject({ code: "upstream_parse" });
  }
  const broken = Buffer.from(png); broken.writeUInt32BE(0, 16);
  fetchMock.mockResolvedValueOnce(new Response(broken, { headers: { "content-type": "image/png" } }));
  await expect(call()).rejects.toMatchObject({ code: "upstream_parse" }); expect(fetchMock).toHaveBeenCalledTimes(5);
});
it("propagates HTTP, timeout and network errors with one request each", async () => {
  fetchMock.mockResolvedValueOnce(new Response("maintenance", { status: 503 }));
  await expect(call()).rejects.toMatchObject({ code: "upstream_http", status: 503 });
  fetchMock.mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
  await expect(call()).rejects.toMatchObject({ code: "upstream_timeout" });
  fetchMock.mockRejectedValueOnce(new Error("offline")); await expect(call()).rejects.toMatchObject({ code: "upstream_network" });
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
