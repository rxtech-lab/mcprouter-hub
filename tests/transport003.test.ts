import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { fixture, jsonFixture, spatialCases, transportCases } from "./transport003-cases";
import { rankTools } from "@/lib/agent/tool-search";

const fetchMock = vi.fn<typeof fetch>();
function call(name: string, input: Record<string, unknown> = {}) {
  const service = services.find((service) => service.tools.some((tool) => tool.name === name || tool.operations?.some((operation) => operation.name === name)))!;
  return executeTool(service, service.tools.flatMap((tool) => tool.operations ?? [tool]).find((tool) => tool.name === name)!, input);
}

beforeEach(() => {
  const cache = new Map();
  setCacheForTesting({ get: async (key) => cache.get(key) ?? null, set: async (key, value) => void cache.set(key, value), delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); setCacheForTesting(null); });

describe("transport batch 003", () => {
  it("registers each supported stable API exactly once and leaves blocked sources undeclared", () => {
    const supported: Record<string, string> = {
      "API-1237": "cad-paragliding", "API-1264": "cedd-piers", "API-1427": "hk-border",
      "API-0029": "kowloon-east-parking", "API-1541": "hk-bus", "API-1825": "epd-ev-chargers",
      "API-1969": "gpa-carparks", "API-1984": "hyd-barrier-fence",
    };
    for (const [id, serviceId] of Object.entries(supported)) {
      expect(services.filter((service) => service.apis.includes(id)).map((service) => service.id)).toEqual([serviceId]);
    }
    for (const id of ["API-1294", "API-0022"]) expect(services.some((service) => service.apis.includes(id))).toBe(false);
  });

  it.each([
    ["paragliding activity areas", "cad_paragliding_areas"], ["public piers", "cedd_public_piers"],
    ["public EV chargers", "epd_public_ev_chargers"], ["barrier fences", "hyd_barrier_fences"],
    ["government public car parks", "gpa_public_carparks"], ["DPO bus stop routes", "bus"],
  ])("discovers %s by ordinary text search", (query, expected) => {
    const candidates = services.flatMap((service) => service.tools.map((tool) => ({ name: tool.name, description: tool.description })));
    expect(rankTools(query, candidates).slice(0, 8)).toContain(expected);
  });
  it.each(transportCases)("surfaces HTTP errors and malformed successful bodies for $tool", async ({ tool, input }) => {
    fetchMock.mockResolvedValueOnce(new Response("Service unavailable", { status: 503 }));
    await expect(call(tool, input)).rejects.toMatchObject({ code: "upstream_http", status: 503 });
    fetchMock.mockResolvedValueOnce(new Response("<html>maintenance</html>"));
    await expect(call(tool, input)).rejects.toMatchObject({ code: "upstream_parse" });
  });

  it.each(spatialCases)("rejects invalid inputs before fetching %s", async (tool) => {
    for (const input of [{ limit: 101 }, { limit: 0 }, { offset: -1 }, { objectId: 1.5 }, { bbox: "180,22,181,23" }, { bbox: "114,23,115,22" }, { bbox: "bad" }, { search: "x".repeat(101) }]) {
      await expect(call(tool, input)).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("escapes apostrophes in fixed search fields and pushes bounds/paging upstream", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(jsonFixture("cad.json"))));
    await call("cad_paragliding_areas", { search: "O'Brien", bbox: "114,22,115,23", offset: 2, geometry: false, lang: "tc" });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.hostname).toBe("portal.csdi.gov.hk");
    expect(url.searchParams.get("where")).toContain("UPPER(Paragliding_Area_TC) LIKE '%O''BRIEN%'");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ geometry: "114,22,115,23", inSR: "4326", resultOffset: "2", returnGeometry: "false" });
  });

  it("localizes names, omits null attributes and honors geometry=false", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(jsonFixture("cad.json"))));
    const result = await call("cad_paragliding_areas", { lang: "tc", geometry: false });
    expect(result.data).toMatchObject({ results: [expect.objectContaining({ name: "浪茄灣", Operating_Altitude: "SFC - 2000 ft AMSL" }), expect.anything()] });
    const first = (result.data as { results: Record<string, unknown>[] }).results[0];
    expect(first).not.toHaveProperty("geometry");
    expect(first).not.toHaveProperty("Boundary_4_Lat");
  });

  it("does not interpret ArcGIS HTTP-200 errors as empty datasets", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: 400, message: "Invalid query" } })));
    await expect(call("hyd_barrier_fences")).rejects.toThrow(/CSDI query failed \(400\)/);
  });

  it("bounds oversized geometry explicitly and paginates oversized attribute results", async () => {
    const features = Array.from({ length: 4 }, (_, id) => ({ attributes: { OBJECTID: id + 1, text: "界".repeat(12000) }, geometry: { paths: Array(10000).fill([114, 22]) } }));
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ features, exceededTransferLimit: true })));
    const { data } = await call("hyd_barrier_fences");
    expect(data).toMatchObject({ returned: 2, nextOffset: 2, hasMore: true, results: [expect.objectContaining({ geometryOmitted: expect.any(String) }), expect.anything()] });
    expect(Buffer.byteLength(JSON.stringify(data))).toBeLessThan(101000);
  });

  it("supports empty spatial pages", async () => {
    fetchMock.mockResolvedValue(new Response('{"features":[]}'));
    expect((await call("cedd_public_piers", { offset: 100 })).data).toMatchObject({ results: [], hasMore: false, nextOffset: null });
  });

  it.each(["en", "tc", "sc"])("reads GPA %s CSV with multiline fees and normalizes column names", async (lang) => {
    fetchMock.mockResolvedValue(new Response(fixture(`gpa-${lang}.csv`)));
    const { data } = await call("gpa_public_carparks", { lang, limit: 1 });
    expect(data).toMatchObject({ returned: 1, nextOffset: 1, hasMore: true, total: 2, language: lang, results: [expect.objectContaining({ name: expect.any(String), fees: expect.stringContaining("\n"), mediumChargers: expect.any(String) })] });
    expect(String(fetchMock.mock.calls[0][0])).toContain(`psi-t-cp_${{ en: "ENG", tc: "TC", sc: "SC" }[lang]}.csv`);
  });

  it("recognizes Customs annual totals separately from quarters", async () => {
    fetchMock.mockResolvedValue(new Response(fixture("customs-annual.csv")));
    expect((await call("border_vehicle_throughput", { year: 2016 })).data).toMatchObject([
      { controlPoint: "All control points", year: 2016, quarter: null, total: 15492 },
    ]);
    expect((await call("border_vehicle_throughput", { year: 2016, quarter: 1 })).data).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("validates DPO operator stop IDs and language mapping", async () => {
    for (const input of [{ operator: "KMB", stopId: "001001" }, { operator: "CTB", stopId: "1" }, { operator: "NLB", stopId: "../1" }, { operator: "NLB", stopId: "1", lang: "fr" }]) {
      await expect(call("dpo_bus_stop_eta", input)).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(jsonFixture("bus-eta.json"))));
    const { data } = await call("dpo_bus_stop_eta", { operator: "NLB", stopId: "1", lang: "sc" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("?lang=zh-hans");
    expect(data).toMatchObject({ results: [expect.objectContaining({ eta: "" }), expect.anything()], generatedAt: expect.any(String) });
  });

  it.each(["gpa_public_carparks"])("validates pagination for %s", async (tool) => {
    await expect(call(tool, { limit: 1000 })).rejects.toThrow();
    await expect(call(tool, { offset: -1 })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
