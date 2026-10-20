import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { rankTools } from "@/lib/agent/tool-search";
import { marketsCases, marketsFixture, marketsTables } from "./finance033-cases";

const service = services.find((candidate) => candidate.id === "censtatd-financial-markets")!;
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

describe("Finance batch 033", () => {
  it("registers exactly ten stable IDs, datasets and tools with unique ownership", () => {
    expect(service.apis).toEqual(["API-0571", "API-0572", "API-0596", "API-0597", "API-0598", "API-0599", "API-0600", "API-0601", "API-0602", "API-0603"]);
    expect(service.datasets).toEqual(marketsTables.map(([table]) => `hk-censtatd-tablechart-${table}`));
    expect(service.tools).toHaveLength(10);
    for (const id of service.apis) expect(services.filter((candidate) => candidate.apis.includes(id))).toEqual([service]);
  });

  it.each(marketsTables)("rejects malformed inputs before fetching %s", async (table, name) => {
    for (const input of [{ period: "202513" }, { period: "2025Q1" }, { period: "2025junk" }, { limit: 101 }, { limit: 0 }, { limit: 1.5 }, { offset: -1 }, { offset: 100001 }, { indicator: "invalid" }, { component: "invalid" }, { measure: "invalid" }, { lang: "fr" }, { freq: "W" }]) {
      await expect(call(name, input)).rejects.toThrow();
    }
    if (["315-38031", "315-38032", "340-47001"].includes(table)) {
      await expect(call(name, { freq: "Q" })).rejects.toThrow();
      await expect(call(name, { period: "202503" })).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(marketsTables)("handles HTTP, invalid JSON, provider and malformed row errors for %s", async (table, name) => {
    const fixture = marketsFixture(table);
    const bodies = [
      ["Unavailable", 503, "upstream_http"],
      ["<html>maintenance</html>", 200, "upstream_parse"],
      [JSON.stringify({ header: { status: { name: "Fail", code: 1 } }, dataSet: [] }), 200, "upstream_parse"],
      [JSON.stringify({ header: fixture.header }), 200, "upstream_parse"],
      ...[null, [], { ...fixture.dataSet[0], figure: {} }, { ...fixture.dataSet[0], period: "202513" }, { ...fixture.dataSet[0], sv: "unknown" }, { ...fixture.dataSet[0], svDesc: "unknown units" }, { ...fixture.dataSet[0], freq: "W" }, { ...fixture.dataSet[0], sd_value: null }].map((row) => [JSON.stringify({ ...fixture, dataSet: [row] }), 200, "upstream_parse"]),
    ];
    for (const [body, status, code] of bodies) {
      fetchMock.mockResolvedValueOnce(new Response(String(body), { status: Number(status) }));
      await expect(call(name)).rejects.toMatchObject({ code });
    }
  });

  it.each(marketsTables)("rejects missing or malformed source dimensions for %s", async (table, name, dimension) => {
    const fixture = marketsFixture(table);
    if (!dimension) return;
    fixture.dataSet = fixture.dataSet.filter((row) => dimension in row);
    for (const value of [undefined, {}, null, "unsupported"]) {
      for (const key of [dimension!, `${dimension}Desc`]) {
        if (key.endsWith("Desc") && value === "unsupported") continue;
        fetchMock.mockResolvedValueOnce(Response.json({ ...fixture, dataSet: [{ ...fixture.dataSet[0], [key]: value }] }));
        await expect(call(name)).rejects.toMatchObject({ code: "upstream_parse" });
      }
    }
  });

  it.each(marketsTables)("maps network and timeout failures for %s", async (_table, name) => {
    fetchMock.mockRejectedValueOnce(new Error("Connection refused"));
    await expect(call(name)).rejects.toMatchObject({ code: "upstream_network" });
    fetchMock.mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"));
    await expect(call(name)).rejects.toMatchObject({ code: "upstream_timeout" });
  });

  it.each(marketsCases)("preserves observations and localized measures for $table", async ({ table, tool, dimension }) => {
    for (const lang of ["en", "tc", "sc"]) {
      const fixture = marketsFixture(table, lang);
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
        expect(fixture.dataSet).toContainEqual(expect.objectContaining({ period: row.period, figure: row.figure, sd_value: row.sd_value, svDesc: row.svDesc, ...(dimension && dimension in row ? { [dimension]: fixture.dataSet.find((r) => String(r[dimension] === "" ? "TOTAL" : r[dimension]) === row.component)?.[dimension] } : {}) }));
        expect(service.tools.find((t) => t.name === tool)!.spec.input.measure.enum).toContain(row.measure);
      }
    }
  });

  it.each(marketsCases)("paginates $table without dropping rows and caches independently by language", async ({ table, tool }) => {
    const fixture = marketsFixture(table);
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

  it.each(marketsCases)("filters year, component, frequency, indicator and every supported measure for $table", async ({ table, tool, dimension }) => {
    const fixture = marketsFixture(table);
    fetchMock.mockImplementation(async () => Response.json(fixture));
    for (const measure of service.tools.find((candidate) => candidate.name === tool)!.spec.input.measure.enum!) {
      const data = (await call(tool, { measure, limit: 100 })).data as { results: Record<string, unknown>[] };
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.results.every((row) => row.measure === measure)).toBe(true);
    }
    const row = fixture.dataSet[0];
    const input = { period: String(row.period).slice(0, 4), freq: row.freq, component: dimension && dimension in row ? String(row[dimension] === "" ? "TOTAL" : row[dimension]) : "NONE", indicator: row.sv };
    const { data } = await call(tool, input);
    expect(data).toMatchObject({ results: expect.arrayContaining([expect.objectContaining(row)]) });
    expect((data as { results: Record<string, unknown>[] }).results.every((r) => String(r.period).startsWith(input.period) && r.freq === input.freq && r.component === input.component && r.sv === input.indicator)).toBe(true);
  });

  it.each(marketsTables)("rejects malformed observations beyond the returned page for %s", async (table, tool) => {
    const fixture = marketsFixture(table);
    fixture.dataSet.push({ ...fixture.dataSet[0], figure: null } as never);
    fetchMock.mockResolvedValueOnce(Response.json(fixture));
    await expect(call(tool, { limit: 1 })).rejects.toMatchObject({ code: "upstream_parse" });
  });

  it("keeps numeric issuer codes, totals and absent dimensions distinct", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(marketsFixture("340-45001")));
    for (const [component, indicator] of [["1", "LT_CIR"], ["TOTAL", "LT_CIR"], ["NONE", "LT_AI"]]) {
      const { data } = await call("currency_in_circulation", { component, indicator, limit: 100 });
      const rows = (data as { results: Record<string, unknown>[] }).results;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.component === component && r.sv === indicator)).toBe(true);
      if (component === "1") expect(rows.every((r) => r.ISSUER === 1)).toBe(true);
      if (component === "NONE") expect(rows.every((r) => !("ISSUER" in r))).toBe(true);
    }
  });

  it("retains Mainland country and activity dimensions and billion-dollar position/flow units", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(marketsFixture("315-38032")));
    for (const indicator of ["DI_POS_ODI", "DI_OUTFLOW"]) {
      const { data } = await call("mainland_outward_di_activities", { indicator, component: "TOTAL" });
      const rows = (data as { results: Record<string, unknown>[] }).results;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.COUNTRY === "CN" && r.ACTIVITY === "" && r.sv === indicator && r.measure === "amount_billion" && r.svDesc === "HK$ billion")).toBe(true);
    }
  });

  it("rejects malformed Mainland country dimensions and unexpected or mismatched components", async () => {
    for (const [table, tool, patch] of [
      ["315-38032", "mainland_outward_di_activities", { COUNTRY: "US" }],
      ["315-38032", "mainland_outward_di_activities", { COUNTRYDesc: null }],
      ["340-45001", "currency_in_circulation", { sv: "LT_AI" }],
      ["340-47001", "government_revenue_expenditure", { sv: "EXP_GRA" }],
    ] as const) {
      const fixture = marketsFixture(table);
      fixture.dataSet = [{ ...fixture.dataSet[0], ...patch } as never];
      fetchMock.mockResolvedValueOnce(Response.json(fixture));
      await expect(call(tool)).rejects.toMatchObject({ code: "upstream_parse" });
    }
  });

  it("supports exact monthly dates and distinguishes monetary levels from growth", async () => {
    const fixture = marketsFixture("340-46002");
    fetchMock.mockResolvedValueOnce(Response.json(fixture));
    const row = fixture.dataSet.find((r) => r.freq === "M")!;
    const { data } = await call("hkd_effective_exchange_indices", { period: row.period, freq: "M" });
    expect((data as { results: Record<string, unknown>[] }).results).toContainEqual({ ...row, component: "NONE", measure: "index" });
    fetchMock.mockResolvedValueOnce(Response.json(marketsFixture("340-45011")));
    for (const [measure, unit] of [["amount_million", "HK$ million"], ["yoy", "Year-on-year % change"]]) {
      const page = (await call("money_supply_all_currencies", { measure })).data as { results: Record<string, unknown>[] };
      expect(page.results.length).toBeGreaterThan(0);
      expect(page.results.every((r) => r.svDesc === unit && r.measure === measure)).toBe(true);
    }
  });

  it("preserves missing figures, negative flows and revision flags without scaling", async () => {
    const fixture = marketsFixture("315-38031");
    const row = { ...fixture.dataSet[0], figure: "", sd_value: "N.A." };
    fixture.dataSet = [row, { ...row, figure: -12.5, sd_value: "r" }];
    fetchMock.mockResolvedValueOnce(Response.json(fixture));
    expect((await call("mainland_outward_di_regions")).data).toMatchObject({ results: fixture.dataSet.map((r) => ({ ...r, component: r.COUNTRY, measure: "amount_billion" })) });
  });

  it("bounds default and maximum output sizes", async () => {
    const fixture = marketsFixture("340-46001");
    fixture.dataSet = Array.from({ length: 150 }, () => ({ ...fixture.dataSet[0] }));
    fetchMock.mockResolvedValueOnce(Response.json(fixture));
    expect((await call("exchange_rates")).data).toMatchObject({ total: 150, returned: 50, nextOffset: 50 });
    expect((await call("exchange_rates", { limit: 100 })).data).toMatchObject({ returned: 100, nextOffset: 100 });
  });

  it.each(marketsTables)("discovers table %s by its tool title", (_table, name) => {
    const tool = service.tools.find((t) => t.name === name)!;
    const candidates = services.flatMap((s) => s.tools.map(({ name, description }) => ({ name, description })));
    expect(rankTools(tool.title!, candidates).slice(0, 8)).toContain(name);
  });
});
