import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { rankTools } from "@/lib/agent/tool-search";
import { definition021, environmentCases, fixture021, json021, spatial021, water021 } from "./environment021-cases";

const fetchMock = vi.fn<typeof fetch>();
let cache: Map<string, unknown>;
function call(name: string, input: Record<string, unknown> = {}) {
  const { service, tool } = definition021(name);
  return executeTool(service, tool, input);
}
beforeEach(() => {
  cache = new Map();
  setCacheForTesting({ get: async (key) => cache.get(key) ?? null, set: async (key, value) => void cache.set(key, value),
    delete: async (key) => void cache.delete(key), expireTag: async () => {} });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); setCacheForTesting(null); });

describe("Environment batch 021", () => {
  it("registers exactly all ten permanent API IDs and their dataset IDs once", () => {
    for (let id = 1833; id <= 1842; id++) {
      const owners = services.filter((s) => s.apis.includes(`API-${id}`));
      expect(owners).toHaveLength(1);
      expect(owners[0].datasets).toContain({
        1833: "hk-epd-marineteam-marine-water-quality-recent-data",
        1834: "hk-epd-recycteam-waste-less-recyclable-collection-points-data",
        1835: "hk-epd-riverteam-river-water-quality-historical-data-en",
        1836: "hk-epd-riverteam-river-water-quality-historical-data-sc",
        1837: "hk-epd-riverteam-river-water-quality-historical-data-tc",
        1838: "hk-epd-riverteam-river-water-quality-recent-data",
        1839: "hk-epd-rngteam-chemical-waste-collectors-list",
        1840: "hk-epd-rngteam-clinical-waste-collectors-list",
        1841: "hk-epd-rngteam-issued-construction-noise-permit",
        1842: "hk-epd-ronteam-pollution-complaint-statistics",
      }[id]);
    }
  });

  it.each(environmentCases)("matches captured $tool $file and caches repeated requests", async (c) => {
    fetchMock.mockImplementation(async () => new Response(typeof c.reply === "string" ? c.reply : JSON.stringify(c.reply)));
    const result = await call(c.tool, c.input);
    expect(result.data).toEqual(c.data);
    expect((await call(c.tool, c.input)).data).toEqual(result.data);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(c.request.url);
  });

  // Each scenario runs under beforeEach with a fresh cache AND mock queue. Keeping
  // same-URL HTTP-200 error/malformed replies in one cached sequence hid later mocks.
  describe.each(spatial021)("$tool isolated failure and empty-page contracts", (c) => {
    it.each([
      ["ArcGIS error envelope", { error: { code: 400, message: "Invalid query" } }, "upstream_http"],
      ["missing features", {}, "upstream_parse"],
      ["malformed feature", { features: [{}] }, "upstream_parse"],
      ["malformed geometry", { features: [{ attributes: { OBJECTID: 1 }, geometry: [] }] }, "upstream_parse"],
    ])("rejects %s after fetching that fixture", async (_label, reply, code) => {
      fetchMock.mockResolvedValueOnce(Response.json(reply));
      await expect(call(c.tool, { geometry: true })).rejects.toMatchObject({ code });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.results[0].type).toBe("return");
    });

    it("returns an empty terminal page after fetching the empty fixture", async () => {
      fetchMock.mockResolvedValueOnce(Response.json({ features: [] }));
      expect((await call(c.tool, { offset: 100 })).data).toMatchObject({ results: [], returned: 0, hasMore: false, nextOffset: null });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("resultOffset")).toBe("100");
    });

    it("validates paging, language and geographic bounds before any HTTP", async () => {
      for (const input of [{ limit: 0 }, { limit: 101 }, { offset: -1 }, { objectId: 1.5 }, { lang: "fr" },
        { bbox: "bad" }, { bbox: "114,23,115,22" }, { bbox: "180,22,181,23" }, { search: "x".repeat(101) }]) {
        await expect(call(c.tool, input)).rejects.toThrow();
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("escapes search literals and pushes object ID, bounds and paging upstream", async () => {
      fetchMock.mockResolvedValueOnce(Response.json(json021(`${c.api}.json`)));
      await call(c.tool, { search: "O'Brien", objectId: 1, bbox: "114,22,115,23", offset: 2, limit: 3 });
      const params = new URL(String(fetchMock.mock.calls[0][0])).searchParams;
      expect(params.get("where")).toContain("O''BRIEN");
      expect(params.get("where")).toContain("OBJECTID=1");
      expect(params.get("where")).not.toContain(" OR ");
      expect(Object.fromEntries(params)).toMatchObject({ geometry: "114,22,115,23", inSR: "4326", resultOffset: "2", resultRecordCount: "3", returnGeometry: "false" });
    });

    it("supports only the published search fields, one per request", async () => {
      const fields = definition021(c.tool).tool.spec.input.searchField.enum!;
      for (const field of fields) {
        fetchMock.mockResolvedValueOnce(Response.json(json021(`${c.api}.json`)));
        await call(c.tool, { search: "test", searchField: field });
        const params = new URL(String(fetchMock.mock.calls.at(-1)![0])).searchParams;
        expect(params.get("where")).toBe(`1=1 AND (UPPER(${field}) LIKE '%TEST%')`);
      }
      const count = fetchMock.mock.calls.length;
      await expect(call(c.tool, { searchField: "OBJECTID); DROP TABLE" })).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(count);
    });

    it("selects each published name language without inventing translations", async () => {
      fetchMock.mockImplementation(async () => Response.json(json021(`${c.api}.json`)));
      for (const [lang, field] of Object.entries(c.nameFields)) {
        const { data } = await call(c.tool, { lang });
        expect(data).toMatchObject({ results: [expect.objectContaining({ name: json021(`${c.api}.json`).features[0].attributes[field] }), expect.anything()] });
      }
      expect(fetchMock).toHaveBeenCalledTimes(1); // lang changes projection, not the upstream URL
    });
  });

  it.each(environmentCases)("surfaces HTTP errors for $tool $file without caching failed requests", async (c) => {
    fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
    await expect(call(c.tool, c.input)).rejects.toMatchObject({ code: "upstream_http", status: 503 });
    fetchMock.mockResolvedValueOnce(new Response(typeof c.reply === "string" ? c.reply : JSON.stringify(c.reply)));
    expect((await call(c.tool, c.input)).data).toEqual(c.data);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(environmentCases)("rejects HTML maintenance bodies for $tool $file", async (c) => {
    fetchMock.mockResolvedValueOnce(new Response("<html>maintenance</html>"));
    await expect(call(c.tool, c.input)).rejects.toMatchObject({ code: "upstream_parse" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(water021)("filters and pages $file preserving units and detection bounds", async (c) => {
    fetchMock.mockImplementation(async () => new Response(fixture021(c.file)));
    const golden = json021("expected-water.json")[c.file];
    expect((await call(c.tool, { ...c.input, station: golden.station.toLowerCase(), limit: 1 })).data).toMatchObject({ total: 3, returned: 1, hasMore: true, nextOffset: 1, results: [golden] });
    expect((await call(c.tool, { ...c.input, search: "no such station" })).data).toMatchObject({ total: 0, returned: 0, hasMore: false, nextOffset: null });
    expect((await call(c.tool, { ...c.input, offset: 3 })).data).toMatchObject({ results: [], nextOffset: null });
    expect((await call(c.tool, { ...c.input, offset: 1, limit: 1 })).data).toMatchObject({ results: [json021("second-water.json")[c.file]], nextOffset: 2 });
    if (!c.file.startsWith("historical")) {
      expect((await call(c.tool, { ...c.input, month: "10/2024" })).data).toMatchObject({ total: 1, results: [golden] });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(water021)("rejects invalid water inputs for $file before HTTP", async (c) => {
    for (const bad of [{ lang: "fr" }, { limit: 101 }, { offset: -1 }, { search: "x".repeat(101) }, { station: "../AN1" },
      ...(c.file.startsWith("historical") ? [{ year: 1985 }, { year: 2026 }, { year: 2025.5 }] : [{ month: "13/2025" }])]) {
      await expect(call(c.tool, { ...c.input, ...bad })).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["header", "row", "date", "quotes"])("rejects malformed CSV %s", async (kind) => {
    const original = fixture021("marine-en.csv");
    const malformed = kind === "header" ? original.replace("Water Control Zone", "Station") : kind === "row" ? original + '\n"short","row"' : kind === "date" ? original.replace("10/2024", "99/2024") : original + '\n"unclosed';
    fetchMock.mockResolvedValueOnce(new Response(malformed));
    await expect(call("epd_recent_marine_water_quality")).rejects.toMatchObject({ code: "upstream_parse" });
  });

  it.each(["en", "tc", "sc"])("retains real 1986 %s observations with missing zone/river labels", async (lang) => {
    fetchMock.mockResolvedValueOnce(new Response(fixture021(`historical-1986-${lang}.csv`)));
    const { data } = await call("epd_historical_river_water_quality", { year: 1986, lang, station: "TR20A" });
    expect(data).toMatchObject({ total: 1, returned: 1, results: [expect.objectContaining({
      station: "TR20A", waterControlZone: "", river: "", date: "1986-01-29", sampleNumber: "1",
    })] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("requires a historical year before making any request", async () => {
    await expect(call("epd_historical_river_water_quality")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds large water responses and keeps pagination usable", async () => {
    const original = fixture021("historical-en.csv");
    const [header, row] = original.trim().split(/\r?\n/);
    fetchMock.mockResolvedValueOnce(new Response([header, ...Array(100).fill(row)].join("\n")));
    const { data } = await call("epd_historical_river_water_quality", { year: 2025, limit: 100 });
    expect(Buffer.byteLength(JSON.stringify(data))).toBeLessThan(101000);
    expect(data).toMatchObject({ hasMore: true, nextOffset: expect.any(Number) });
  });

  it.each([
    ["marine water quality", "epd_recent_marine_water_quality"], ["historical river water quality", "epd_historical_river_water_quality"],
    ["recyclable collection points", "epd_recyclable_collection_points"], ["chemical waste collectors", "epd_chemical_waste_collectors"],
    ["clinical waste collectors", "epd_clinical_waste_collectors"], ["construction noise permits", "epd_construction_noise_permits"],
    ["pollution complaint statistics", "epd_pollution_complaint_statistics"],
  ])("discovers %s", (query, tool) => {
    expect(rankTools(query, services.flatMap((s) => s.tools.map((t) => ({ name: t.name, description: t.description })))).slice(0, 8)).toContain(tool);
  });
});
