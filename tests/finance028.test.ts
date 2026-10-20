import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { rankTools } from "@/lib/agent/tool-search";
import { financeCases, gdpFixture, gdpTables } from "./finance028-cases";

const service = services.find((candidate) => candidate.id === "censtatd-gdp")!;
const fetchMock = vi.fn<typeof fetch>();
function call(name: string, input: Record<string, unknown> = {}) {
  return executeTool(service, service.tools.find((tool) => tool.name === name)!, input);
}
beforeEach(() => {
  const cache = new Map<string, unknown>();
  setCacheForTesting({ get: async (key) => cache.get(key) ?? null, set: async (key, value) => void cache.set(key, value), delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); setCacheForTesting(null); });

describe("Finance batch 028", () => {
  it("registers exactly the ten stable IDs and datasets once", () => {
    expect(service.apis).toEqual(Array.from({ length: 10 }, (_, index) => `API-0${521 + index}`));
    expect(service.datasets).toEqual(gdpTables.map(([table]) => `hk-censtatd-tablechart-${table}`));
    for (const id of service.apis) expect(services.filter((candidate) => candidate.apis.includes(id))).toEqual([service]);
    expect(service.tools).toHaveLength(10);
  });

  it.each(gdpTables)("rejects malformed inputs before fetching table %s", async (_table, name) => {
    for (const input of [{ period: "202501" }, { period: "2025Q1" }, { period: "2025junk" }, { limit: 101 }, { limit: 0 }, { limit: 1.5 }, { offset: -1 }, { offset: 100001 }, { indicator: "invalid" }, { component: "invalid" }, { measure: "invalid" }, { lang: "fr" }, { freq: "M" }]) {
      await expect(call(name, input)).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(gdpTables)("handles HTTP, JSON and provider errors for %s", async (_table, name) => {
    for (const [body, status, code] of [["Unavailable", 503, "upstream_http"], ["<html>maintenance</html>", 200, "upstream_parse"], [JSON.stringify({ header: { status: { name: "Fail", code: 1 } }, dataSet: [] }), 200, "upstream_parse"], [JSON.stringify({ header: { status: { name: "Success", code: 0 } } }), 200, "upstream_parse"]] as const) {
      fetchMock.mockResolvedValueOnce(new Response(body, { status }));
      await expect(call(name)).rejects.toMatchObject({ code });
    }
  });

  it.each(financeCases)("preserves localized observations in en/tc/sc for $table", async ({ table, tool, input }) => {
    for (const lang of ["en", "tc", "sc"]) {
      const fixture = gdpFixture(table, lang);
      fetchMock.mockResolvedValueOnce(Response.json(fixture));
      const { data } = await call(tool, { ...input, lang });
      expect(data).toMatchObject({ language: lang, title: fixture.header.title, returned: 1, results: [expect.objectContaining({ figure: fixture.dataSet[0].figure, svDesc: fixture.dataSet[0].svDesc, measure: input.measure })] });
      expect(String(fetchMock.mock.lastCall![0])).toContain(`lang=${lang}`);
    }
  });

  it("paginates newest-first with no dropped series and reuses the cached full table", async () => {
    fetchMock.mockResolvedValue(Response.json(gdpFixture("310-31002")));
    const first = (await call("gdp_expenditure_current", { limit: 2 })).data as { results: Record<string, unknown>[]; total: number };
    const second = (await call("gdp_expenditure_current", { limit: 2, offset: 2 })).data as typeof first;
    const all = (await call("gdp_expenditure_current", { limit: 100 })).data as typeof first;
    expect(first).toMatchObject({ returned: 2, hasMore: true, nextOffset: 2 });
    expect([...first.results, ...second.results]).toEqual(all.results.slice(0, 4));
    expect(all.results.map((row) => row.period)).toEqual(all.results.map((row) => row.period).sort().reverse());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await call("gdp_expenditure_current", { offset: 99999 })).data).toMatchObject({ results: [], returned: 0, hasMore: false, nextOffset: null });
  });

  it("filters a whole year, and distinguishes level from growth with the same indicator", async () => {
    fetchMock.mockResolvedValue(Response.json(gdpFixture("310-31001")));
    const level = (await call("gdp_and_per_capita", { period: "2026", indicator: "CUR", measure: "level" })).data as { results: Record<string, unknown>[] };
    const yoy = (await call("gdp_and_per_capita", { period: "2026", indicator: "CUR", measure: "yoy" })).data as typeof level;
    expect(level.results.length).toBeGreaterThan(0);
    expect(yoy.results.length).toBeGreaterThan(0);
    expect(level.results.every((row) => row.svDesc === "HK$ million" && String(row.period).startsWith("2026"))).toBe(true);
    expect(yoy.results.every((row) => row.svDesc === "Year-on-year % change")).toBe(true);
    expect((await call("gdp_and_per_capita", { period: "1900" })).data).toMatchObject({ total: 0, results: [] });
  });

  it("preserves unavailable values and revisions with the original notes", async () => {
    const fixture = gdpFixture("310-31001");
    fetchMock.mockResolvedValue(Response.json(fixture));
    const { data } = await call("gdp_and_per_capita");
    expect(data).toMatchObject({ notes: fixture.header.tablenote, results: expect.arrayContaining([expect.objectContaining({ figure: "", sd_value: "N.A." }), expect.objectContaining({ sd_value: "r" })]) });
  });

  it.each(["en", "tc", "sc"])("recognizes seasonally adjusted qoq figures without a component field in %s", async (lang) => {
    fetchMock.mockResolvedValue(Response.json(gdpFixture("310-30001", lang)));
    const { data } = await call("gdp_real_growth", { lang, freq: "Q", indicator: "SA1", component: "TOTAL", measure: "qoq" });
    expect(data).toMatchObject({ returned: 1, results: [expect.objectContaining({ figure: -0.6, period: "202606", component: "TOTAL", measure: "qoq" })] });
  });

  it("bounds the default and maximum page sizes", async () => {
    const fixture = gdpFixture("310-31001");
    fixture.dataSet = Array.from({ length: 150 }, () => ({ ...fixture.dataSet[0] }));
    fetchMock.mockResolvedValue(Response.json(fixture));
    expect((await call("gdp_and_per_capita")).data).toMatchObject({ total: 150, returned: 50, nextOffset: 50 });
    expect((await call("gdp_and_per_capita", { limit: 100 })).data).toMatchObject({ returned: 100, nextOffset: 100 });
    await expect(call("gdp_expenditure_ratios", { period: "202503" })).rejects.toThrow();
    await expect(call("gdp_seasonally_adjusted", { freq: "Y" })).rejects.toThrow();
  });

  it.each([null, [], { freq: "Q", period: "bad" }, { freq: "Q", period: "202603", sv: "CUR", svDesc: "HK$ million", figure: {}, sd_value: "" }])("rejects a malformed observation %j", async (row) => {
    const fixture = gdpFixture("310-31001");
    fetchMock.mockResolvedValue(Response.json({ ...fixture, dataSet: [row] }));
    await expect(call("gdp_and_per_capita")).rejects.toMatchObject({ code: "upstream_parse" });
  });

  it.each([["GDP real growth", "gdp_real_growth"], ["GDP per capita", "gdp_and_per_capita"], ["private consumption expenditure chained", "pce_components_chained"]])("discovers %s", (query, name) => {
    const candidates = services.flatMap((candidate) => candidate.tools.map(({ name, description }) => ({ name, description })));
    expect(rankTools(query, candidates).slice(0, 8)).toContain(name);
  });
});
