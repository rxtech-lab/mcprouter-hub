import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { rankTools } from "@/lib/agent/tool-search";
import { cases024, entries024, definition024, profileCase024 } from "./environment024-cases";
const fetchMock = vi.fn<typeof fetch>();
const call = (name: string, input = {}) => { const { service, tool } = definition024(name); return executeTool(service, tool, input); };
beforeEach(() => {
  const cache = new Map<string, unknown>();
  setCacheForTesting({ get: async (k) => cache.get(k) ?? null, set: async (k, v) => void cache.set(k, v), delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); setCacheForTesting(null); });
describe("Environment Health 024", () => {
  it.each(entries024)("registers $id only once and makes $tool discoverable", (e) => {
    expect(services.filter((s) => s.apis.includes(e.id))).toHaveLength(1);
    expect(definition024(e.tool).service.datasets).toContain(e.dataset);
    expect(rankTools(e.title, services.flatMap((s) => s.tools.map((t) => ({ name: t.name, description: t.description })))).slice(0, 10)).toContain(e.tool);
  });
  it.each(cases024)("preserves captured $tool $lang data and caches raw source", async (c) => {
    fetchMock.mockResolvedValue(Response.json(c.reply));
    expect((await call(c.tool, c.input)).data).toEqual(c.data);
    expect((await call(c.tool, c.input)).data).toEqual(c.data);
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(String(fetchMock.mock.calls[0][0])).toBe(c.request.url);
  });
  describe.each(cases024)("$tool $lang error contract", (c) => {
    it.each([[503, "maintenance", "upstream_http"], [200, "<html>maintenance</html>", "upstream_parse"], [200, "{}", "upstream_parse"]])("rejects status %s body %s", async (status, body, code) => {
      fetchMock.mockResolvedValue(new Response(String(body), { status: Number(status) }));
      await expect(call(c.tool, c.input)).rejects.toMatchObject({ code });
    });
    it("rejects invalid inputs before HTTP", async () => {
      for (const bad of [{ limit: 0 }, { limit: 101 }, { offset: -1 }, { offset: 1.1 }, ...(c.languages.length ? [{ lang: "fr" }] : []),
        ...(c.kind === "spatial" ? [{ bbox: "invalid" }, { bbox: "114,23,115,22" }, { objectId: 1.5 }] : c.kind === "census" ? [{ period: "202313" }, { indicator: "bad" }] : [{ year: 1.5 }, { search: "x".repeat(101) }])]) {
        await expect(call(c.tool, { ...c.input, ...bad })).rejects.toThrow();
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });
    it("returns empty pages without phantom cursors", async () => {
      fetchMock.mockResolvedValue(Response.json(c.kind === "spatial" ? { features: [] } : c.reply));
      expect((await call(c.tool, { ...c.input, offset: 1000000 })).data).toMatchObject({ results: [], returned: 0, hasMore: false, nextOffset: null });
    });
    it("rejects malformed records before applying filters", async () => {
      const bad = structuredClone(c.reply);
      if (c.kind === "spatial") bad.features[0].attributes = [];
      else if (c.kind === "census") bad.dataSet[0].figure = "NaN";
      else bad[0].category[0].dataset[0].unit = null;
      fetchMock.mockResolvedValue(Response.json(bad));
      await expect(call(c.tool, c.input)).rejects.toMatchObject({ code: "upstream_parse" });
    });
  });
  it.each(cases024.filter((c) => c.kind === "census" || c.kind === "towngas"))("paginates cached $tool $lang without changing data", async (c) => {
    fetchMock.mockResolvedValue(Response.json(c.reply));
    const a = (await call(c.tool, { ...c.input, limit: 1 })).data as { results: unknown[] };
    const b = (await call(c.tool, { ...c.input, limit: 2, offset: 1 })).data as { results: unknown[] };
    expect([...a.results, ...b.results]).toEqual(c.data.results); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(cases024.filter((c) => c.kind === "census" || c.kind === "towngas"))("handles a genuinely empty $tool $lang source", async (c) => {
    fetchMock.mockResolvedValue(Response.json(c.kind === "census" ? { ...c.reply, dataSet: [] } : []));
    expect((await call(c.tool, c.input)).data).toMatchObject({ results: [], total: 0, returned: 0, nextOffset: null, hasMore: false });
  });
  it.each(cases024.filter((c) => c.kind === "census"))("surfaces provider query errors for $tool $lang", async (c) => {
    fetchMock.mockResolvedValue(Response.json({ header: { status: { code: 500, name: "Error" } } }));
    await expect(call(c.tool, c.input)).rejects.toMatchObject({ code: "upstream_http" });
  });
  it.each(entries024.filter((e) => e.kind === "spatial"))("bounds $tool output bytes with a usable cursor", async (e) => {
    const name = (e.names as Record<string, string> | undefined)?.en;
    fetchMock.mockResolvedValue(Response.json({ features: Array.from({ length: 100 }, (_, i) => ({ attributes: { OBJECTID: i + 1, [name ?? "annual_500"]: "x".repeat(2000) } })) }));
    const data = (await call(e.tool, { limit: 100, offset: 10 })).data as { returned: number; nextOffset: number };
    expect(Buffer.byteLength(JSON.stringify(data))).toBeLessThan(101000);
    expect(data.returned).toBeGreaterThan(0); expect(data.returned).toBeLessThan(100); expect(data.nextOffset).toBe(10 + data.returned);
  });
  it.each(cases024.filter((c) => c.kind === "census"))("preserves $tool $lang flags, units, totals and filters", async (c) => {
    fetchMock.mockResolvedValue(Response.json(c.reply));
    const row = c.reply.dataSet.find((r: Record<string, unknown>) => r.figure === "") ?? c.reply.dataSet[0];
    const dims = Object.keys(row).filter((k) => !["freq", "period", "sv", "svDesc", "figure", "sd_value"].includes(k) && !k.endsWith("Desc"));
    const args = Object.fromEntries(dims.map((k) => [k, row[k] === "" ? "TOTAL" : row[k]]));
    expect((await call(c.tool, { ...c.input, ...args, period: row.period, freq: row.freq, indicator: row.sv })).data).toMatchObject({ results: [expect.objectContaining(row)] });
  });
  it.each(cases024.filter((c) => c.kind === "spatial"))("uses bounded single-field $tool $lang query and WGS84 geometry", async (c) => {
    fetchMock.mockResolvedValue(Response.json(c.reply));
    const args = { ...c.input, objectId: 1, geometry: true, bbox: "113,22,115,23", ...(c.fields?.length ? { search: "O'Brien" } : {}) };
    const data = (await call(c.tool, args)).data as { results: Record<string, unknown>[] };
    expect(data.results[0].geometry).toEqual(c.reply.features[0].geometry);
    const p = new URL(String(fetchMock.mock.calls[0][0])).searchParams;
    expect(p.get("geometry")).toBe("113,22,115,23"); expect(p.get("outSR")).toBe("4326");
    if (c.fields?.length) expect(p.get("where")).toBe(`1=1 AND OBJECTID=1 AND (UPPER(${c.lang === "tc" && c.fields.length > 1 ? "CompanyNameChi" : c.fields[0]}) LIKE '%O''BRIEN%')`);
  });
  it("normalizes historical Towngas data and filters by metric/year", async () => {
    const c = cases024.find((c) => c.kind === "towngas")!; fetchMock.mockResolvedValue(Response.json(c.reply));
    const d = (await call(c.tool, { year: 2013, search: "Electricity Consumption", limit: 100 })).data as { results: { year: number; metric: string }[] };
    expect(d.results.length).toBeGreaterThan(0); expect(d.results.every((r) => r.year === 2013 && r.metric.includes("Electricity Consumption"))).toBe(true);
  });
});
describe("Planning wind file adapter", () => {
  function mock(body = profileCase024.body, grid = profileCase024.grid) { fetchMock.mockImplementation(async (url) => String(url).endsWith(".txt") ? new Response(body) : Response.json(grid)); }
  it("reads the actual linked tab-delimited profile, retaining speed bands and fractions", async () => {
    mock(); const d = (await call(profileCase024.tool, profileCase024.input)).data;
    expect(d).toMatchObject({ objectId: 1, grid: "g_00337", height: 500, season: "annual", total: 24, returned: 3, nextOffset: 3, speedUnit: "m/s", frequencyUnit: "fraction", results: [expect.objectContaining({ speedBand: "00_to_01", directions: expect.objectContaining({ N: expect.any(Number) }) }), expect.anything(), expect.anything()] });
    expect((await call(profileCase024.tool, { objectId: 1, offset: 24 })).data).toMatchObject({ results: [], nextOffset: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each(["{}", "g_00337\tWind_direction\tN", profileCase024.body.replace("00_to_01", "bad"), profileCase024.body.replace("V_infinity(m/s)", "bad")])("rejects malformed file", async (body) => { mock(body); await expect(call(profileCase024.tool, profileCase024.input)).rejects.toMatchObject({ code: "upstream_parse" }); });
  it("rejects hostile download URLs before making any download", async () => {
    const grid = structuredClone(profileCase024.grid); grid.features[0].attributes.annual_500 = "https://evil.invalid/secret"; mock(undefined, grid);
    await expect(call(profileCase024.tool, profileCase024.input)).rejects.toMatchObject({ code: "upstream_parse" }); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("returns an empty page for unknown grid", async () => { mock(undefined, { features: [] }); expect((await call(profileCase024.tool, { objectId: 2147483647 })).data).toMatchObject({ results: [], nextOffset: null }); expect(fetchMock).toHaveBeenCalledTimes(1); });
  it("validates all selection inputs before HTTP", async () => { for (const input of [{}, { objectId: -1 }, { objectId: 1, season: "spring" }, { objectId: 1, height: 400 }, { objectId: 1, limit: 101 }]) await expect(call(profileCase024.tool, input)).rejects.toThrow(); expect(fetchMock).not.toHaveBeenCalled(); });
  it("surfaces download HTTP failure", async () => { fetchMock.mockResolvedValueOnce(Response.json(profileCase024.grid)).mockResolvedValueOnce(new Response("maintenance", { status: 503 })); await expect(call(profileCase024.tool, profileCase024.input)).rejects.toMatchObject({ code: "upstream_http", status: 503 }); });
});
