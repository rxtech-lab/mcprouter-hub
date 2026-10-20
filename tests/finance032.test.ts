import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { rankTools } from "@/lib/agent/tool-search";
import { investmentCases, investmentFixture, investmentTables } from "./finance032-cases";

const service = services.find((candidate) => candidate.id === "censtatd-investment")!;
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

describe("Finance batch 032", () => {
  it("registers exactly ten stable IDs, datasets and tools with unique ownership", () => {
    expect(service.apis).toEqual(Array.from({ length: 10 }, (_, index) => `API-0${561 + index}`));
    expect(service.datasets).toEqual(investmentTables.map(([table]) => `hk-censtatd-tablechart-${table}`));
    expect(service.tools).toHaveLength(10);
    for (const id of service.apis) expect(services.filter((candidate) => candidate.apis.includes(id))).toEqual([service]);
  });

  it.each(investmentTables)("rejects malformed inputs before fetching %s", async (table, name) => {
    for (const input of [{ period: "202501" }, { period: "2025Q1" }, { period: "2025junk" }, { limit: 101 }, { limit: 0 }, { limit: 1.5 }, { offset: -1 }, { offset: 100001 }, { indicator: "invalid" }, { component: "invalid" }, { measure: "invalid" }, { lang: "fr" }, { freq: "M" }]) {
      await expect(call(name, input)).rejects.toThrow();
    }
    if (["315-38011", "315-38012", "315-38021", "315-38022"].includes(table)) {
      await expect(call(name, { freq: "Q" })).rejects.toThrow();
      await expect(call(name, { period: "202503" })).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(investmentTables)("handles HTTP, invalid JSON, provider and malformed row errors for %s", async (table, name) => {
    const fixture = investmentFixture(table);
    const bodies = [
      ["Unavailable", 503, "upstream_http"],
      ["<html>maintenance</html>", 200, "upstream_parse"],
      [JSON.stringify({ header: { status: { name: "Fail", code: 1 } }, dataSet: [] }), 200, "upstream_parse"],
      [JSON.stringify({ header: fixture.header }), 200, "upstream_parse"],
      ...[null, [], { ...fixture.dataSet[0], figure: {} }, { ...fixture.dataSet[0], period: "202501" }, { ...fixture.dataSet[0], sv: "unknown" }, { ...fixture.dataSet[0], svDesc: "unknown units" }, { ...fixture.dataSet[0], freq: "M" }, { ...fixture.dataSet[0], svDesc: table === "315-38011" || table === "315-38012" || table === "315-38021" || table === "315-38022" ? "HK$ million" : "HK$ billion" }].map((row) => [JSON.stringify({ ...fixture, dataSet: [row] }), 200, "upstream_parse"]),
    ];
    for (const [body, status, code] of bodies) {
      fetchMock.mockResolvedValueOnce(new Response(String(body), { status: Number(status) }));
      await expect(call(name)).rejects.toMatchObject({ code });
    }
  });

  it.each(investmentTables)("rejects missing or malformed source dimensions for %s", async (table, name, dimension) => {
    const fixture = investmentFixture(table);
    for (const value of [undefined, 123, null, "unsupported"]) {
      for (const key of [dimension!, `${dimension}Desc`]) {
        if (key.endsWith("Desc") && value === "unsupported") continue;
        fetchMock.mockResolvedValueOnce(Response.json({ ...fixture, dataSet: [{ ...fixture.dataSet[0], [key]: value }] }));
        await expect(call(name)).rejects.toMatchObject({ code: "upstream_parse" });
      }
    }
  });

  it.each(investmentTables)("maps network and timeout failures for %s", async (_table, name) => {
    fetchMock.mockRejectedValueOnce(new Error("Connection refused"));
    await expect(call(name)).rejects.toMatchObject({ code: "upstream_network" });
    fetchMock.mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"));
    await expect(call(name)).rejects.toMatchObject({ code: "upstream_timeout" });
  });

  it.each(investmentCases)("preserves observations and localized measures for $table", async ({ table, tool, dimension }) => {
    for (const lang of ["en", "tc", "sc"]) {
      const fixture = investmentFixture(table, lang);
      fetchMock.mockResolvedValueOnce(Response.json(fixture));
      const result = (await call(tool, { lang, limit: 100 })).data as { results: Record<string, unknown>[]; nextOffset: number | null };
      let nextOffset = result.nextOffset;
      while (nextOffset !== null) {
        const page = (await call(tool, { lang, limit: 100, offset: nextOffset })).data as typeof result;
        result.results.push(...page.results);
        nextOffset = page.nextOffset;
      }
      expect(result.results).toHaveLength(fixture.dataSet.length);
      expect(result).toMatchObject({ title: fixture.header.title, language: lang, notes: fixture.header.tablenote });
      expect(String(fetchMock.mock.lastCall![0])).toContain(`lang=${lang}`);
      for (const row of result.results) {
        expect(fixture.dataSet).toContainEqual(expect.objectContaining({ period: row.period, figure: row.figure, sd_value: row.sd_value, svDesc: row.svDesc, ...(dimension ? { [dimension]: row.component === "TOTAL" ? "" : row.component } : {}) }));
        const expectedMeasure = ["% to GDP", "相對本地生產總值的百分比", "相对本地生产总值的百分比"].includes(String(row.svDesc)) ? "ratio" : ["Quarter-to-quarter % change", "按季變動百分率", "按季变动百分率"].includes(String(row.svDesc)) ? "qoq" : ["Year-on-year % change", "按年變動百分率", "按年变动百分率"].includes(String(row.svDesc)) ? "yoy" : "level";
        expect(row.measure).toBe(expectedMeasure);
      }
    }
  });

  it.each(investmentCases)("paginates $table without dropping rows and caches independently by language", async ({ table, tool }) => {
    const fixture = investmentFixture(table);
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

  it.each(investmentCases)("filters year, component, frequency, indicator and every supported measure for $table", async ({ table, tool, dimension }) => {
    const fixture = investmentFixture(table);
    fetchMock.mockImplementation(async () => Response.json(fixture));
    for (const measure of service.tools.find((candidate) => candidate.name === tool)!.spec.input.measure.enum!) {
      const data = (await call(tool, { measure, limit: 100 })).data as { results: Record<string, unknown>[] };
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.results.every((row) => row.measure === measure)).toBe(true);
    }
    const row = fixture.dataSet[0];
    const input = { period: String(row.period).slice(0, 4), freq: row.freq, component: dimension ? row[dimension] || "TOTAL" : "TOTAL", indicator: row.sv };
    const { data } = await call(tool, input);
    expect(data).toMatchObject({ results: expect.arrayContaining([expect.objectContaining(row)]) });
    expect((data as { results: Record<string, unknown>[] }).results.every((r) => String(r.period).startsWith(input.period) && r.freq === input.freq && r.component === input.component && r.sv === input.indicator)).toBe(true);
  });

  it("preserves synthetic missing figures, negative values and revision flags", async () => {
    const fixture = investmentFixture("315-37006");
    const row = { ...fixture.dataSet[0], figure: "", sd_value: "P" };
    fixture.dataSet = [row, { ...row, figure: -12.5, sd_value: "r" }];
    fetchMock.mockResolvedValueOnce(Response.json(fixture));
    const data = (await call("net_investment_flows_sector")).data as { results: Record<string, unknown>[] };
    expect(data.results).toEqual(fixture.dataSet.map((r) => ({ ...r, component: r.BOP_COMPONENT, measure: "level" })));
  });

  it("bounds default and maximum output sizes", async () => {
    const fixture = investmentFixture("315-37021");
    fixture.dataSet = Array.from({ length: 150 }, () => ({ ...fixture.dataSet[0] }));
    fetchMock.mockImplementation(async () => Response.json(fixture));
    expect((await call("international_investment_position")).data).toMatchObject({ total: 150, returned: 50, nextOffset: 50 });
    expect((await call("international_investment_position", { limit: 100 })).data).toMatchObject({ returned: 100, nextOffset: 100 });
  });

  it("keeps GDP ratios distinct from amounts, and billion units unscaled", async () => {
    fetchMock.mockImplementation(async (url) => Response.json(investmentFixture(new URL(String(url)).searchParams.get("id")!)));
    for (const measure of ["ratio", "level"]) {
      const { data } = await call("iip_gdp_ratios", { measure });
      const rows = (data as { results: Record<string, unknown>[] }).results;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.measure === measure && r.svDesc === (measure === "ratio" ? "% to GDP" : "HK$ million"))).toBe(true);
    }
    const { data } = await call("inward_direct_investment_countries");
    expect((data as { results: Record<string, unknown>[] }).results.every((r) => r.svDesc === "HK$ billion")).toBe(true);
  });

  it("filters currency and component independently, including total currency", async () => {
    const fixture = investmentFixture("315-37023");
    fetchMock.mockImplementation(async () => Response.json(fixture));
    for (const currency of ["HKD", "USD", "OC", "TOTAL"]) {
      const { data } = await call("iip_currency_composition", { currency, component: "IIP_ATS", limit: 100 });
      const rows = (data as { results: Record<string, unknown>[] }).results;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.IIP_COMPONENT === "IIP_ATS" && (r.CURRENCY || "TOTAL") === currency)).toBe(true);
    }
    await expect(call("iip_currency_composition", { currency: "EUR" })).rejects.toThrow();
  });

  it("rejects missing, unknown and malformed currency codes and labels", async () => {
    const fixture = investmentFixture("315-37023");
    for (const key of ["CURRENCY", "CURRENCYDesc"]) {
      for (const value of [undefined, null, 123, ...(key === "CURRENCY" ? ["EUR"] : [])]) {
        fetchMock.mockResolvedValueOnce(Response.json({ ...fixture, dataSet: [{ ...fixture.dataSet[0], [key]: value }] }));
        await expect(call("iip_currency_composition")).rejects.toMatchObject({ code: "upstream_parse" });
      }
    }
  });

  it("separates position, transaction flow and income for inward and outward country tables", async () => {
    for (const [table, name] of investmentTables.filter(([table]) => ["315-38011", "315-38021"].includes(table))) {
      fetchMock.mockImplementation(async () => Response.json(investmentFixture(table)));
      for (const indicator of service.tools.find((t) => t.name === name)!.spec.input.indicator.enum!) {
        const { data } = await call(name, { indicator, component: "CN", limit: 100 });
        const rows = (data as { results: Record<string, unknown>[] }).results;
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((r) => r.sv === indicator && r.COUNTRY === "CN")).toBe(true);
      }
    }
  });

  it.each([["net investment flows sector", "net_investment_flows_sector"], ["currency composition international investment position", "iip_currency_composition"], ["external debt", "external_debt"], ["inward direct investment economic activity", "inward_direct_investment_activities"], ["outward direct investment country", "outward_direct_investment_countries"]])("discovers %s", (query, name) => {
    const candidates = services.flatMap((candidate) => candidate.tools.map(({ name, description }) => ({ name, description })));
    expect(rankTools(query, candidates).slice(0, 8)).toContain(name);
  });
});
