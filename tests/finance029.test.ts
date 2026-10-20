import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { rankTools } from "@/lib/agent/tool-search";
import { expenditureCases, expenditureFixture, expenditureTables } from "./finance029-cases";

const service = services.find((candidate) => candidate.id === "censtatd-gdp-expenditure")!;
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

describe("Finance batch 029", () => {
  it("registers exactly ten stable IDs, datasets and tools with unique ownership", () => {
    expect(service.apis).toEqual(Array.from({ length: 10 }, (_, index) => `API-0${531 + index}`));
    expect(service.datasets).toEqual(expenditureTables.map(([table]) => `hk-censtatd-tablechart-${table}`));
    expect(service.tools).toHaveLength(10);
    for (const id of service.apis) expect(services.filter((candidate) => candidate.apis.includes(id))).toEqual([service]);
  });

  it.each(expenditureTables)("rejects malformed inputs before fetching %s", async (table, name) => {
    for (const input of [{ period: "202501" }, { period: "2025Q1" }, { period: "2025junk" }, { limit: 101 }, { limit: 0 }, { limit: 1.5 }, { offset: -1 }, { offset: 100001 }, { indicator: "invalid" }, { component: "invalid" }, { measure: "invalid" }, { lang: "fr" }, { freq: "M" }]) {
      await expect(call(name, input)).rejects.toThrow();
    }
    if (["310-31013", "310-31014", "310-31015", "310-32023", "310-32024"].includes(table)) {
      await expect(call(name, { freq: "Q" })).rejects.toThrow();
      await expect(call(name, { period: "202503" })).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(expenditureTables)("handles HTTP, invalid JSON, provider and malformed row errors for %s", async (table, name) => {
    const fixture = expenditureFixture(table);
    const bodies = [
      ["Unavailable", 503, "upstream_http"],
      ["<html>maintenance</html>", 200, "upstream_parse"],
      [JSON.stringify({ header: { status: { name: "Fail", code: 1 } }, dataSet: [] }), 200, "upstream_parse"],
      [JSON.stringify({ header: fixture.header }), 200, "upstream_parse"],
      ...[null, [], { ...fixture.dataSet[0], figure: {} }, { ...fixture.dataSet[0], period: "202501" }, { ...fixture.dataSet[0], GDP_COMPONENT: 123 }].map((row) => [JSON.stringify({ ...fixture, dataSet: [row] }), 200, "upstream_parse"]),
    ];
    for (const [body, status, code] of bodies) {
      fetchMock.mockResolvedValueOnce(new Response(String(body), { status: Number(status) }));
      await expect(call(name)).rejects.toMatchObject({ code });
    }
  });

  it.each(expenditureCases)("preserves observations and localized measures for $table", async ({ table, tool }) => {
    for (const lang of ["en", "tc", "sc"]) {
      const fixture = expenditureFixture(table, lang);
      fetchMock.mockResolvedValueOnce(Response.json(fixture));
      const result = (await call(tool, { lang, limit: 100 })).data as { results: Record<string, unknown>[] };
      expect(result).toMatchObject({ title: fixture.header.title, language: lang, notes: fixture.header.tablenote });
      expect(String(fetchMock.mock.lastCall![0])).toContain(`lang=${lang}`);
      for (const row of result.results) {
        expect(fixture.dataSet).toContainEqual(expect.objectContaining({ period: row.period, figure: row.figure, sd_value: row.sd_value, svDesc: row.svDesc, GDP_COMPONENT: row.component }));
        const expectedMeasure = row.svDesc === "%" || String(row.svDesc).includes("distribution") || String(row.svDesc).includes("分布") ? "distribution" : ["Year-on-year % change", "按年變動百分率", "按年变动百分率"].includes(String(row.svDesc)) ? "yoy" : "level";
        expect(row.measure).toBe(expectedMeasure);
      }
    }
  });

  it.each(expenditureCases)("paginates $table without dropping rows and caches independently by language", async ({ table, tool }) => {
    const fixture = expenditureFixture(table);
    fetchMock.mockImplementation(async () => Response.json(fixture));
    const first = (await call(tool, { limit: 2 })).data as { results: Record<string, unknown>[]; nextOffset: number };
    const second = (await call(tool, { limit: 2, offset: first.nextOffset })).data as typeof first;
    const all = (await call(tool, { limit: 100 })).data as typeof first;
    expect(first).toMatchObject({ returned: 2, hasMore: true, nextOffset: 2 });
    expect([...first.results, ...second.results]).toEqual(all.results.slice(0, 4));
    expect(all.results.map((row) => row.period)).toEqual(all.results.map((row) => row.period).sort().reverse());
    expect((await call(tool, { period: "1900" })).data).toMatchObject({ total: 0, results: [], nextOffset: null });
    expect((await call(tool, { offset: 99999 })).data).toMatchObject({ returned: 0, hasMore: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await call(tool, { lang: "tc" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(expenditureCases)("filters year, component, frequency, indicator and every supported measure for $table", async ({ table, tool }) => {
    const fixture = expenditureFixture(table);
    fetchMock.mockImplementation(async () => Response.json(fixture));
    for (const measure of service.tools.find((candidate) => candidate.name === tool)!.spec.input.measure.enum!) {
      const data = (await call(tool, { measure, limit: 100 })).data as { results: Record<string, unknown>[] };
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.results.every((row) => row.measure === measure)).toBe(true);
    }
    const row = fixture.dataSet[0];
    const input = { period: String(row.period).slice(0, 4), freq: row.freq, component: row.GDP_COMPONENT, indicator: row.sv };
    const { data } = await call(tool, input);
    expect(data).toMatchObject({ results: expect.arrayContaining([expect.objectContaining(row)]) });
    expect((data as { results: Record<string, unknown>[] }).results.every((r) => String(r.period).startsWith(input.period) && r.freq === input.freq && r.component === input.component && r.sv === input.indicator)).toBe(true);
  });

  it("preserves unavailable values, negative figures and revision flags", async () => {
    const fixture = expenditureFixture("310-32031");
    fetchMock.mockImplementation(async () => Response.json(fixture));
    const data = (await call("gdfcf_components_current", { limit: 100 })).data as { results: Record<string, unknown>[] };
    for (const row of fixture.dataSet.filter((r) => r.figure === "" || r.sd_value !== "" || Number(r.figure) < 0)) {
      expect(data.results).toContainEqual(expect.objectContaining(row));
    }
    expect(data.results.some((row) => row.figure === "")).toBe(true);
    expect(data.results.some((row) => row.sd_value === "r")).toBe(true);
  });

  it("bounds default and maximum output sizes", async () => {
    const fixture = expenditureFixture("310-31013");
    fixture.dataSet = Array.from({ length: 150 }, () => ({ ...fixture.dataSet[0] }));
    fetchMock.mockImplementation(async () => Response.json(fixture));
    expect((await call("cxdm_groups_current")).data).toMatchObject({ total: 150, returned: 50, nextOffset: 50 });
    expect((await call("cxdm_groups_current", { limit: 100 })).data).toMatchObject({ returned: 100, nextOffset: 100 });
  });

  it.each([["consumption domestic commodity chained", "cxdm_groups_chained"], ["government consumption social economic function", "gce_functions_current"], ["exports imports services component", "services_trade_components_current"]])("discovers %s", (query, name) => {
    const candidates = services.flatMap((candidate) => candidate.tools.map(({ name, description }) => ({ name, description })));
    expect(rankTools(query, candidates).slice(0, 8)).toContain(name);
  });
});
