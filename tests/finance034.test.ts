import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { rankTools } from "@/lib/agent/tool-search";
import { governmentCases, governmentFixture, governmentTables } from "./finance034-cases";

const service = services.find((candidate) => candidate.id === "censtatd-government-markets")!;
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

describe("Finance batch 034", () => {
  it("registers exactly ten stable IDs, datasets and tools with unique ownership", () => {
    expect(service.apis).toEqual(["API-0604", "API-0605", "API-0606", "API-0607", "API-0608", "API-0609", "API-0610", "API-0611", "API-0612", "API-0613"]);
    expect(service.datasets).toEqual(governmentTables.map(([table]) => `hk-censtatd-tablechart-${table}`));
    expect(service.tools).toHaveLength(10);
    for (const id of service.apis) expect(services.filter((candidate) => candidate.apis.includes(id))).toEqual([service]);
    for (const id of service.datasets) expect(services.filter((candidate) => candidate.datasets.includes(id))).toEqual([service]);
  });

  it.each(governmentTables)("rejects malformed inputs before fetching %s", async (table, name) => {
    for (const input of [{ period: "202513" }, { period: "2025Q1" }, { period: "2025junk" }, { limit: 101 }, { limit: 0 }, { limit: 1.5 }, { offset: -1 }, { offset: 100001 }, { indicator: "invalid" }, { component: "invalid" }, { measure: "invalid" }, { lang: "fr" }, { freq: "W" }]) {
      await expect(call(name, input)).rejects.toThrow();
    }
    if (["340-47011", "340-47012"].includes(table)) {
      await expect(call(name, { freq: "Q" })).rejects.toThrow();
      await expect(call(name, { period: "202503" })).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(governmentTables)("handles HTTP, invalid JSON, provider and malformed row errors for %s", async (table, name) => {
    const fixture = governmentFixture(table);
    const bodies = [
      ["Unavailable", 503, "upstream_http"],
      ["<html>maintenance</html>", 200, "upstream_parse"],
      [JSON.stringify({ header: { status: { name: "Fail", code: 1 } }, dataSet: [] }), 200, "upstream_parse"],
      [JSON.stringify({ header: fixture.header }), 200, "upstream_parse"],
      ...[null, [], { ...fixture.dataSet[0], figure: {} }, { ...fixture.dataSet[0], figure: "not a figure" }, { ...fixture.dataSet[0], period: "202513" }, { ...fixture.dataSet[0], sv: "unknown" }, { ...fixture.dataSet[0], svDesc: "unknown units" }, { ...fixture.dataSet[0], freq: "W" }, { ...fixture.dataSet[0], sd_value: null }].map((row) => [JSON.stringify({ ...fixture, dataSet: [row] }), 200, "upstream_parse"]),
    ];
    for (const [body, status, code] of bodies) {
      fetchMock.mockResolvedValueOnce(new Response(String(body), { status: Number(status) }));
      await expect(call(name)).rejects.toMatchObject({ code });
    }
  });

  it.each(governmentTables)("rejects missing or malformed source dimensions for %s", async (table, name, dimension) => {
    const fixture = governmentFixture(table);
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

  it.each(governmentTables)("maps network and timeout failures for %s", async (_table, name) => {
    fetchMock.mockRejectedValueOnce(new Error("Connection refused"));
    await expect(call(name)).rejects.toMatchObject({ code: "upstream_network" });
    fetchMock.mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"));
    await expect(call(name)).rejects.toMatchObject({ code: "upstream_timeout" });
  });

  it.each(governmentCases)("preserves observations and localized measures for $table", async ({ table, tool, dimension }) => {
    for (const lang of ["en", "tc", "sc"]) {
      const fixture = governmentFixture(table, lang);
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
        const { component, measure, ...original } = row;
        expect(fixture.dataSet).toContainEqual(original);
        expect(component).toBe(dimension ? String(original[dimension] === "" ? "TOTAL" : original[dimension]) : "NONE");
        expect(typeof measure).toBe("string");
        expect(service.tools.find((t) => t.name === tool)!.spec.input.measure.enum).toContain(row.measure);
      }
    }
  });

  it.each(governmentCases)("paginates $table without dropping rows and caches independently by language", async ({ table, tool }) => {
    const fixture = governmentFixture(table);
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

  it.each(governmentCases)("filters year, component, frequency, indicator and every supported measure for $table", async ({ table, tool, dimension }) => {
    const fixture = governmentFixture(table);
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

  it.each(governmentTables)("rejects malformed observations beyond the returned page for %s", async (table, tool) => {
    const fixture = governmentFixture(table);
    fixture.dataSet.push({ ...fixture.dataSet[0], figure: null } as never);
    fetchMock.mockResolvedValueOnce(Response.json(fixture));
    await expect(call(tool, { limit: 1 })).rejects.toMatchObject({ code: "upstream_parse" });
  });

  it("keeps Stock Connect HKD buy/sell values separate from RMB turnover", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(governmentFixture("340-95005")));
    for (const [indicator, measure, unit] of [
      ["BUY_VALUE_SSE", "amount_billion", "HK$ billion"],
      ["AVG_DAILY_SELL_SZSE", "amount_billion", "HK$ billion"],
      ["TURNOVER_SSE", "rmb_billion", "RMB billion"],
      ["AVG_DAILY_TURNOVER_SZSE", "rmb_billion", "RMB billion"],
    ]) {
      const page = (await call("stock_connect_trading_values", { indicator })).data as { results: Record<string, unknown>[] };
      expect(page.results.length).toBeGreaterThan(0);
      expect(page.results.every((r) => r.measure === measure && r.svDesc === unit && r.component === "NONE")).toBe(true);
    }
    expect((await call("stock_connect_trading_values", { indicator: "TURNOVER_SSE", measure: "amount_billion" })).data).toMatchObject({ total: 0, results: [] });
  });

  it("preserves gold turnover currencies and silver prices per ten ounces", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(governmentFixture("340-95006")));
    for (const [indicator, measure, unit] of [["ADT_CGSE", "amount_million", "HK$ million"], ["ADT_LLG", "usd_million", "US$ million"]]) {
      const page = (await call("gold_exchange_turnover", { indicator })).data as { results: Record<string, unknown>[] };
      expect(page.results.length).toBeGreaterThan(0);
      expect(page.results.every((r) => r.measure === measure && r.svDesc === unit)).toBe(true);
    }
    const fixture = governmentFixture("340-92002");
    const row = fixture.dataSet.find((r) => r.freq === "M")!;
    fetchMock.mockResolvedValueOnce(Response.json(fixture));
    const page = (await call("silver_trading_prices", { period: row.period, freq: "M", indicator: row.sv })).data;
    expect(page).toMatchObject({ results: [{ ...row, component: "NONE", measure: "silver_hkd_10oz" }] });
  });

  it("separates HKEX counts, capitalisation, turnover, fundraising and contract volume", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(governmentFixture("340-95003")));
    for (const [indicator, measure, unit] of [["LC", "count", "Number"], ["SEC_ISSUE", "count", "Number"], ["TMC", "amount_billion", "HK$ billion"], ["AVG_TURNOVER", "amount_million", "HK$ million"], ["FUND_RAISED", "amount_million", "HK$ million"]]) {
      const page = (await call("hkex_securities_statistics", { indicator })).data as { results: Record<string, unknown>[] };
      expect(page.results.length).toBeGreaterThan(0);
      expect(page.results.every((r) => r.measure === measure && r.svDesc === unit)).toBe(true);
    }
    const all = (await call("hkex_securities_statistics", { component: "MB", indicator: "LC" })).data as { results: Record<string, unknown>[] };
    expect(all.results.length).toBeGreaterThan(0);
    expect(all.results.every((r) => r.SECURITIES_MARKET === "MB")).toBe(true);
    const children = (await call("hkex_securities_statistics", { component: "MB-H", indicator: "LC" })).data as typeof all;
    expect(children.results.length).toBeGreaterThan(0);
    expect(children.results.every((r) => r.SECURITIES_MARKET === "MB-H")).toBe(true);
    fetchMock.mockResolvedValueOnce(Response.json(governmentFixture("340-95004")));
    const page = (await call("hkex_derivatives_volume")).data as typeof all;
    expect(page.results.every((r) => r.measure === "contracts" && r.svDesc === "Number of contracts")).toBe(true);
  });

  it("distinguishes the three-month interbank rate from average daily trading", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(governmentFixture("340-95001")));
    for (const [indicator, measure, unit] of [["THREE_M_INTEREST", "interest_rate", "Period average, % per annum"], ["AVE_DAILY_TRADE", "amount_billion", "HK$ billion"]]) {
      const page = (await call("interbank_market", { indicator })).data as { results: Record<string, unknown>[] };
      expect(page.results.length).toBeGreaterThan(0);
      expect(page.results.every((r) => r.measure === measure && r.svDesc === unit)).toBe(true);
    }
  });

  it("preserves financial-year codes, empty total codes, missing figures and source flags", async () => {
    const fixture = governmentFixture("340-47011");
    fetchMock.mockResolvedValueOnce(Response.json(fixture));
    const total = (await call("government_revenue_funds", { component: "TOTAL" })).data as { results: Record<string, unknown>[] };
    expect(total.results.length).toBeGreaterThan(0);
    expect(total.results.every((r) => r.REV_TYPE === "" && String(r.period).length === 4)).toBe(true);
    expect((await call("government_revenue_funds")).data).toMatchObject({ notes: expect.arrayContaining([expect.stringContaining("1 April to 31 March")]) });
    for (const flag of ["-", "[#7]"]) {
      const row = fixture.dataSet.find((r) => r.sd_value === flag)!;
      expect(row).toBeDefined();
      const page = (await call("government_revenue_funds", { component: String(row.REV_TYPE), period: row.period, limit: 100 })).data as typeof total;
      expect(page.results).toContainEqual({ ...row, component: String(row.REV_TYPE), measure: "amount_million" });
    }
    fetchMock.mockResolvedValueOnce(Response.json(governmentFixture("340-95005")));
    const missing = (await call("stock_connect_trading_values", { limit: 100 })).data as typeof total;
    expect(missing.results.some((r) => r.figure === "" && r.sd_value === "-")).toBe(true);
  });

  it.each(governmentTables.filter(([table]) => table !== "340-92002" && table !== "340-47011" && table !== "340-47012"))("rejects non-quarter periods for %s", async (_table, tool) => {
    await expect(call(tool, { period: "202501" })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps revenue and expenditure components separate and rejects cross-indicator components", async () => {
    const fixture = governmentFixture("340-47002");
    fetchMock.mockResolvedValueOnce(Response.json(fixture));
    expect((await call("government_quarterly_revenue_expenditure", { indicator: "REV_GRA", component: "EXP_1" })).data).toMatchObject({ total: 0, results: [] });
    const page = (await call("government_quarterly_revenue_expenditure", { indicator: "REV_GRA", component: "REV_1" })).data as { results: Record<string, unknown>[] };
    expect(page.results.length).toBeGreaterThan(0);
    expect(page.results.every((r) => r.TYPE_GRA === "REV_1" && r.freq === "Q")).toBe(true);
  });

  it("rejects valid units and components paired with the wrong indicator", async () => {
    for (const [table, tool, patch] of [
      ["340-47002", "government_quarterly_revenue_expenditure", { sv: "EXP_GRA" }],
      ["340-95005", "stock_connect_trading_values", { svDesc: "RMB billion" }],
      ["340-95006", "gold_exchange_turnover", { svDesc: "US$ million" }],
      ["340-95003", "hkex_securities_statistics", { svDesc: "HK$ billion" }],
    ] as const) {
      const fixture = governmentFixture(table);
      fixture.dataSet = [{ ...fixture.dataSet[0], ...patch }];
      fetchMock.mockResolvedValueOnce(Response.json(fixture));
      await expect(call(tool)).rejects.toMatchObject({ code: "upstream_parse" });
    }
  });

  it("bounds default and maximum output sizes", async () => {
    const fixture = governmentFixture("340-95002");
    fixture.dataSet = Array.from({ length: 150 }, () => ({ ...fixture.dataSet[0] }));
    fetchMock.mockResolvedValueOnce(Response.json(fixture));
    expect((await call("exchange_fund_bills_notes_turnover")).data).toMatchObject({ total: 150, returned: 50, nextOffset: 50 });
    expect((await call("exchange_fund_bills_notes_turnover", { limit: 100 })).data).toMatchObject({ returned: 100, nextOffset: 100 });
  });

  it.each(governmentTables)("discovers table %s by its tool title", (_table, name) => {
    const tool = service.tools.find((t) => t.name === name)!;
    const candidates = services.flatMap((s) => s.tools.map(({ name, description }) => ({ name, description })));
    expect(rankTools(tool.title!, candidates).slice(0, 8)).toContain(name);
  });
});
