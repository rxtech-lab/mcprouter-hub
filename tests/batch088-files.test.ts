import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { call088 } from "./batch088-cases";

const fetchMock = vi.fn<typeof fetch>();
const raster = (year: number) => JSON.parse(readFileSync(new URL(`./fixtures/batch088/raster-${year}.json`, import.meta.url), "utf8"));
beforeEach(() => {
  const store = new Map<string, unknown>();
  setCacheForTesting({ get: async (k) => store.get(k) ?? null, set: async (k, v) => void store.set(k, v), delete: async () => {}, expireTag: async () => {} });
  vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); setCacheForTesting(null); });
it.each([2018,2019,2020,2021,2022,2023,2024,2025])("reads a real raster cell and its unmodified class attributes: %s", async (year) => {
  const body = raster(year); fetchMock.mockResolvedValueOnce(Response.json(body));
  const input = { longitude: 114.17, latitude: 22.3, year };
  const data = (await call088("pland_land_use_cell", input)).data;
  expect(data).toMatchObject({ ...input, returned: 1, results: [{ code: 32, layerName: body.results[0].layerName, attributes: body.results[0].attributes }] });
  await call088("pland_land_use_cell", input); expect(fetchMock).toHaveBeenCalledTimes(1);
  const q = new URL(String(fetchMock.mock.calls[0][0])).searchParams;
  expect(q.get("geometry")).toBe("114.17,22.3"); expect(q.get("sr")).toBe("4326"); expect(q.get("tolerance")).toBe("0");
});
it("distinguishes NoData from class zero and handles outside coverage", async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ results: [] }));
  expect((await call088("pland_land_use_cell", { longitude: 114, latitude: 22.2 })).data).toMatchObject({ results: [], returned: 0 });
  const body = raster(2025); body.results[0].attributes = { "Stretch.Pixel Value": "NoData" };
  fetchMock.mockResolvedValueOnce(Response.json(body));
  expect((await call088("pland_land_use_cell", { longitude: 114.1, latitude: 22.2 })).data).toMatchObject({ results: [{ code: null }] });
});
it("rejects invalid raster inputs before network", async () => {
  for (const input of [{ longitude: 0, latitude: 22.3 }, { longitude: 114, latitude: 90 }, { longitude: 114, latitude: 22.3, year: 2026 }, { latitude: 22.3 }]) await expect(call088("pland_land_use_cell", input)).rejects.toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
});
it.each(["pland_land_use_cell"])("propagates transport, HTTP, timeout and malformed failures without retry: %s", async (tool) => {
  const input = { longitude: 114.17, latitude: 22.3 };
  fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 })); await expect(call088(tool, input)).rejects.toMatchObject({ code: "upstream_http", status: 503 });
  fetchMock.mockRejectedValueOnce(new Error("offline")); await expect(call088(tool, input)).rejects.toMatchObject({ code: "upstream_network" });
  fetchMock.mockRejectedValueOnce(new DOMException("timeout", "TimeoutError")); await expect(call088(tool, input)).rejects.toMatchObject({ code: "upstream_timeout" });
  fetchMock.mockResolvedValueOnce(new Response("<html>maintenance</html>")); await expect(call088(tool, input)).rejects.toMatchObject({ code: "upstream_parse" });
  expect(fetchMock).toHaveBeenCalledTimes(4);
});
it("rejects raster error envelopes, wrong layers, malformed attributes and oversized values", async () => {
  for (const [n, body] of [null, {}, { error: { code: 400, message: "Bad coordinate" } }, { results: [{}] }, { results: [{ layerId: 1, layerName: "x", attributes: {} }] }, { results: [{ layerId: 0, layerName: "x", attributes: { "Stretch.Pixel Value": "<html>" } }] }, { results: [{ layerId: 0, layerName: "x", attributes: { "Stretch.Pixel Value": "32", huge: "x".repeat(1001) } }] }, { results: [{ layerId: 0, layerName: "x", attributes: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`k${i}`, "32"])) }] }].entries()) {
    fetchMock.mockResolvedValueOnce(Response.json(body));
    await expect(call088("pland_land_use_cell", { longitude: 114 + n / 100, latitude: 22.3 })).rejects.toMatchObject({ code: n === 2 ? "upstream_http" : "upstream_parse" });
  }
});
