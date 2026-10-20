import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { rankTools } from "@/lib/agent/tool-search";
import { accountsCases, accountsFixture, accountsTables } from "./finance030-cases";

const service = services.find((candidate) => candidate.id === "censtatd-national-accounts")!;
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

describe("Finance batch 030", () => {
  it("registers exactly ten stable IDs, datasets and tools with unique ownership", () => {
    expect(service.apis).toEqual(Array.from({ length: 10 }, (_, index) => `API-0${541 + index}`));
    expect(service.datasets).toEqual(accountsTables.map(([table]) => `hk-censtatd-tablechart-${table}`));
    expect(service.tools).toHaveLength(10);
    for (const id of service.apis) expect(services.filter((candidate) => candidate.apis.includes(id))).toEqual([service]);
  });

  it.each(accountsTables)("rejects malformed inputs before fetching %s", async (table, name) => {
    for (const input of [{ period: "202501" }, { period: "2025Q1" }, { period: "2025junk" }, { limit: 101 }, { limit: 0 }, { limit: 1.5 }, { offset: -1 }, { offset: 100001 }, { indicator: "invalid" }, { component: "invalid" }, { measure: "invalid" }, { lang: "fr" }, { freq: "M" }]) {
      await expect(call(name, input)).rejects.toThrow();
    }
    if (["310-34101", "310-34102", "310-34201", "310-34401", "310-34402", "310-34403"].includes(table)) {
      await expect(call(name, { freq: "Q" })).rejects.toThrow();
      await expect(call(name, { period: "202503" })).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(accountsTables)("handles HTTP, invalid JSON, provider and malformed row errors for %s", async (table, name) => {
    const fixture = accountsFixture(table);
    const bodies = [
      ["Unavailable", 503, "upstream_http"],
      ["<html>maintenance</html>", 200, "upstream_parse"],
      [JSON.stringify({ header: { status: { name: "Fail", code: 1 } }, dataSet: [] }), 200, "upstream_parse"],
      [JSON.stringify({ header: fixture.header }), 200, "upstream_parse"],
      ...[null, [], { ...fixture.dataSet[0], figure: {} }, { ...fixture.dataSet[0], period: "202501" }, { ...fixture.dataSet[0], sv: "unknown" }, { ...fixture.dataSet[0], svDesc: "unknown units" }, { ...fixture.dataSet[0], freq: "M" }].map((row) => [JSON.stringify({ ...fixture, dataSet: [row] }), 200, "upstream_parse"]),
    ];
    for (const [body, status, code] of bodies) {
      fetchMock.mockResolvedValueOnce(new Response(String(body), { status: Number(status) }));
      await expect(call(name)).rejects.toMatchObject({ code });
    }
  });

  it.each(accountsTables.filter((entry) => entry[2] !== null))("rejects missing or malformed source dimensions for %s", async (table, name, dimension) => {
    const fixture = accountsFixture(table);
    for (const value of [undefined, 123, null, "unsupported"]) {
      for (const key of [dimension!, `${dimension}Desc`]) {
        if (key.endsWith("Desc") && value === "unsupported") continue;
        fetchMock.mockResolvedValueOnce(Response.json({ ...fixture, dataSet: [{ ...fixture.dataSet[0], [key]: value }] }));
        await expect(call(name)).rejects.toMatchObject({ code: "upstream_parse" });
      }
    }
  });

  it.each(accountsTables)("maps network and timeout failures for %s", async (_table, name) => {
    fetchMock.mockRejectedValueOnce(new Error("Connection refused"));
    await expect(call(name)).rejects.toMatchObject({ code: "upstream_network" });
    fetchMock.mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"));
    await expect(call(name)).rejects.toMatchObject({ code: "upstream_timeout" });
  });

  it.each(accountsCases)("preserves observations and localized measures for $table", async ({ table, tool, dimension }) => {
    for (const lang of ["en", "tc", "sc"]) {
      const fixture = accountsFixture(table, lang);
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
        const expectedMeasure = row.svDesc === "(%)" ? "ratio" : ["% contribution to GDP", "佔本地生產總值的百分比", "占本地生产总值的百分比"].includes(String(row.svDesc)) ? "share" : ["Year-on-year % change", "按年變動百分率", "按年变动百分率"].includes(String(row.svDesc)) ? "yoy" : "level";
        expect(row.measure).toBe(expectedMeasure);
      }
    }
  });

  it.each(accountsCases)("paginates $table without dropping rows and caches independently by language", async ({ table, tool }) => {
    const fixture = accountsFixture(table);
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

  it.each(accountsCases)("filters year, component, frequency, indicator and every supported measure for $table", async ({ table, tool, dimension }) => {
    const fixture = accountsFixture(table);
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

  it("distinguishes GDP shares, discrepancy ratios and per capita monetary units", async () => {
    fetchMock.mockImplementation(async (url) => {
      const table = new URL(String(url)).searchParams.get("id")!;
      return Response.json(accountsFixture(table));
    });
    const share = (await call("gdp_activity_current", { measure: "share", component: "TOTAL" })).data;
    expect(share).toMatchObject({ results: expect.arrayContaining([expect.objectContaining({ ACTIVITY: "", component: "TOTAL", svDesc: "% contribution to GDP", measure: "share" })]) });
    const ratio = (await call("gdp_production_current", { indicator: "STAT_DISCREPANCY" })).data;
    expect(ratio).toMatchObject({ results: expect.arrayContaining([expect.objectContaining({ svDesc: "(%)", measure: "ratio" })]) });
    for (const indicator of ["CURPGNI", "PRGNI"]) {
      const data = (await call("gni_and_per_capita", { indicator, measure: "level" })).data as { results: Record<string, unknown>[] };
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.results.every((r) => r.svDesc === "HK$")).toBe(true);
    }
  });

  it("preserves synthetic missing figures, negative values and revision flags", async () => {
    const fixture = accountsFixture("310-34403");
    const row = { ...fixture.dataSet[0], figure: "", sd_value: "P" };
    fixture.dataSet = [row, { ...row, figure: -12.5, sd_value: "r" }];
    fetchMock.mockResolvedValueOnce(Response.json(fixture));
    const data = (await call("national_accounts_aggregates")).data as { results: Record<string, unknown>[] };
    expect(data.results).toEqual(fixture.dataSet.map((r) => ({ ...r, component: "TOTAL", measure: "level" })));
  });

  it("bounds default and maximum output sizes", async () => {
    const fixture = accountsFixture("310-34101");
    fixture.dataSet = Array.from({ length: 150 }, () => ({ ...fixture.dataSet[0] }));
    fetchMock.mockImplementation(async () => Response.json(fixture));
    expect((await call("gdp_activity_current")).data).toMatchObject({ total: 150, returned: 50, nextOffset: 50 });
    expect((await call("gdp_activity_current", { limit: 100 })).data).toMatchObject({ returned: 100, nextOffset: 100 });
  });

  it.each([["generation income institutional sector", "generation_of_income_account"], ["real gross domestic income", "real_gross_domestic_income"], ["national income per capita", "gni_and_per_capita"]])("discovers %s", (query, name) => {
    const candidates = services.flatMap((candidate) => candidate.tools.map(({ name, description }) => ({ name, description })));
    expect(rankTools(query, candidates).slice(0, 8)).toContain(name);
  });
});
