import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { rankTools } from "@/lib/agent/tool-search";
import { contracts } from "@/mcp/services/censtatd-building-business/contract";
import { batch060, fixture060 } from "./batch060-cases";

const service = services.find((s) => s.id === "censtatd-building-business")!;
const fetchMock = vi.fn<typeof fetch>();
function call(name: string, input: Record<string, unknown> = {}) {
  return executeTool(service, service.tools.find((t) => t.name === name)!, input);
}
function noCache() {
  setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
}
beforeEach(() => {
  const store = new Map<string, unknown>();
  setCacheForTesting({ get: async (k) => store.get(k) ?? null, set: async (k, v) => void store.set(k, v), delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); setCacheForTesting(null); });

type Page = { results: Record<string, unknown>[]; nextOffset: number | null; returned: number; total: number };
describe("Commerce batch060", () => {
  it("registers exactly ten stable APIs and dataset IDs with unique ownership", () => {
    expect(service.apis).toEqual(batch060.map((c) => c.api));
    expect(service.datasets).toEqual(batch060.map((c) => `hk-censtatd-tablechart-${c.table.toLowerCase()}`));
    expect(service.tools.map((t) => t.name)).toEqual(batch060.map((c) => c.tool));
    for (const c of batch060) expect(services.filter((s) => s.apis.includes(c.api))).toEqual([service]);
    for (const d of service.datasets) expect(services.filter((s) => s.datasets.includes(d))).toEqual([service]);
    expect(service.cacheTtl).toBe(3600);
  });

  it.each(batch060)("validates bounded inputs before network for $api", async (c) => {
    const invalid: Record<string, unknown>[] = [{ limit: 0 }, { limit: 101 }, { limit: 1.1 }, { offset: -1 }, { offset: 100001 }, { offset: 0.1 },
      { lang: "fr" }, { period: "202513" }, { period: "2025Q1" }, { period: "202501" }, { indicator: "invalid" }, { freq: "W" }, { measure: "invalid" }];
    if (contracts[c.table].frequencies.join() === "Y") invalid.push({ period: "202501" });
    for (const { input } of Object.values(contracts[c.table].dimensions)) invalid.push({ [input]: "invalid" });
    for (const input of invalid) await expect(call(c.tool, input)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(batch060)("preserves localized source observations, notes, units and flags for $api", async (c) => {
    for (const lang of ["en", "tc", "sc"]) {
      const fixture = fixture060(c.table, lang);
      fetchMock.mockResolvedValueOnce(Response.json(fixture));
      const result = await call(c.tool, { lang, limit: 100 });
      expect(result.meta.source).toBe(`https://www.censtatd.gov.hk/api/get.php?id=${c.table}&full_series=1&lang=${lang}`);
      expect(result.data).toMatchObject({ title: fixture.header.title, language: lang, notes: fixture.header.tablenote, source: fixture.header.source, total: fixture.dataSet.length });
      const all = [...(result.data as Page).results];
      let next = (result.data as Page).nextOffset;
      while (next !== null) {
        const continuation = (await call(c.tool, { lang, limit: 100, offset: next })).data as Page;
        expect(continuation.returned).toBeGreaterThan(0);
        all.push(...continuation.results); next = continuation.nextOffset;
      }
      expect(all).toHaveLength(fixture.dataSet.length);
      expect(all.map((r) => r.period)).toEqual(all.map((r) => r.period).sort().reverse());
      for (const original of fixture.dataSet) expect(all).toContainEqual(expect.objectContaining(original));
      for (const r of all) expect(r.measure).toBe(contracts[c.table].units[String(r.svDesc)]);
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each(batch060)("paginates and caches upstream resources independently of local filters for $api", async (c) => {
    const fixture = fixture060(c.table);
    fetchMock.mockImplementation(async () => Response.json(fixture));
    const first = (await call(c.tool, { limit: 2 })).data as Page;
    const second = (await call(c.tool, { limit: 2, offset: first.nextOffset })).data as Page;
    const all = (await call(c.tool, { limit: 100 })).data as Page;
    expect(first).toMatchObject({ returned: 2, nextOffset: 2, hasMore: true });
    expect([...first.results, ...second.results]).toEqual(all.results.slice(0, 4));
    expect((await call(c.tool, { period: "1900" })).data).toMatchObject({ total: 0, returned: 0, results: [], hasMore: false, nextOffset: null });
    expect((await call(c.tool, { offset: 100000 })).data).toMatchObject({ returned: 0, nextOffset: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.lastCall![1]).toMatchObject({ cache: "no-store", signal: expect.any(AbortSignal) });
    await call(c.tool, { lang: "tc" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(batch060)("filters every supported dimension, measure, indicator and frequency for $api", async (c) => {
    const fixture = fixture060(c.table);
    fetchMock.mockResolvedValueOnce(Response.json(fixture));
    const contract = contracts[c.table];
    for (const r of fixture.dataSet) {
      const args = { period: String(r.period), freq: r.freq, indicator: r.sv, measure: contract.units[String(r.svDesc)],
        ...Object.fromEntries(Object.entries(contract.dimensions).map(([key, v]) => [v.input, r[key] === "" ? "TOTAL" : String(r[key])])) };
      const page = (await call(c.tool, args)).data as Page;
      expect(page.results.length).toBeGreaterThan(0);
      expect(page.results).toContainEqual(expect.objectContaining(r));
      for (const row of page.results) {
        expect(row).toMatchObject({ period: r.period, freq: r.freq, sv: r.sv, measure: args.measure });
        for (const [key, v] of Object.entries(contract.dimensions)) expect(row[v.input]).toBe(r[key] === "" ? "TOTAL" : String(r[key]));
      }
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(batch060)("rejects malformed envelopes and observations, including beyond the returned page for $api", async (c) => {
    noCache();
    const f = fixture060(c.table);
    const r = f.dataSet[0];
    const badRows: unknown[] = [null, [], {}, { ...r, figure: null }, { ...r, figure: "NaN" }, { ...r, sv: "unknown" },
      { ...r, svDesc: "unknown" }, { ...r, sd_value: null }, { ...r, freq: "W" }, { ...r, period: "202513" }, { ...r, freq: "Q", period: "202501" }];
    for (const key of Object.keys(contracts[c.table].dimensions)) badRows.push({ ...r, [key]: null }, { ...r, [key]: "unknown" }, { ...r, [key + "Desc"]: null });
    const alternateUnit = Object.keys(contracts[c.table].units).find((unit) => !contracts[c.table].indicatorUnits[String(r.sv)].includes(unit));
    if (alternateUnit) badRows.push({ ...r, svDesc: alternateUnit });
    const bodies: unknown[] = [null, [], {}, { ...f, header: { ...f.header, status: { name: "Fail", code: 1 } } },
      { ...f, header: { ...f.header, tablenote: [null] } }, { ...f, header: { ...f.header, count: { noOfRecords: -1 } } },
      { header: f.header }, ...badRows.map((row) => ({ ...f, header: { ...f.header, count: { noOfRecords: 2 } }, dataSet: [r, row] }))];
    for (const body of bodies) {
      fetchMock.mockResolvedValueOnce(Response.json(body));
      await expect(call(c.tool, { limit: 1, period: "1900" })).rejects.toMatchObject({ code: "upstream_parse" });
    }
  });

  it.each(batch060)("handles empty datasets and all upstream failure types without retry for $api", async (c) => {
    noCache();
    const f = fixture060(c.table);
    fetchMock.mockResolvedValueOnce(Response.json({ ...f, header: { ...f.header, count: { noOfRecords: 0 } }, dataSet: [] }));
    expect((await call(c.tool)).data).toMatchObject({ total: 0, results: [], nextOffset: null });
    fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
    await expect(call(c.tool)).rejects.toMatchObject({ code: "upstream_http", status: 503 });
    fetchMock.mockResolvedValueOnce(new Response("<html>Maintenance</html>"));
    await expect(call(c.tool)).rejects.toMatchObject({ code: "upstream_parse" });
    fetchMock.mockRejectedValueOnce(new Error("unreachable"));
    await expect(call(c.tool)).rejects.toMatchObject({ code: "upstream_network" });
    fetchMock.mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
    await expect(call(c.tool)).rejects.toMatchObject({ code: "upstream_timeout" });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it.each(batch060)("exposes $api to relevant tool discovery", (c) => {
    // A precise official table ID must identify its corresponding tool.
    expect(rankTools(c.table, services.flatMap((s) => s.tools)).slice(0, 8)).toContain(c.tool);
  });

  it("keeps company counts, monetary levels, growth rates and suppressed values distinct", async () => {
    const c = batch060.find((entry) => entry.table === "615-73011")!;
    fetchMock.mockResolvedValueOnce(Response.json(fixture060(c.table)));
    const counts = (await call(c.tool, { indicator: "HC", measure: "number", limit: 100 })).data as Page;
    const growth = (await call(c.tool, { indicator: "HC", measure: "yoy_percent", limit: 100 })).data as Page;
    expect(counts.returned).toBeGreaterThan(0); expect(growth.returned).toBeGreaterThan(0);
    expect(counts.results.every((r) => r.sv === "HC" && r.svDesc === "Number")).toBe(true);
    expect(growth.results.every((r) => r.sv === "HC" && r.svDesc === "Year-on-year % change")).toBe(true);
    expect(growth.results.some((r) => r.figure === "" && r.sd_value === "-")).toBe(true);
    expect(growth.results.some((r) => r.sd_value === "[§3]")).toBe(true);
    const money = (await call(c.tool, { indicator: "GVCW", measure: "hkd_million" })).data as Page;
    expect(money.returned).toBeGreaterThan(0);
    expect(money.results.every((r) => r.svDesc === "HK$ million")).toBe(true);
    expect(contracts[c.table].indicatorUnits.HC).not.toContain("HK$ million");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(batch060.filter((c) => contracts[c.table].dimensions.TR_GRP || contracts[c.table].dimensions.GVCW_GRP || contracts[c.table].dimensions.IVA_GRP))(
    "preserves original classification codes and TOTAL alias for $api", async (c) => {
      const fixture = fixture060(c.table);
      fetchMock.mockResolvedValueOnce(Response.json(fixture));
      const [dimension, { input: alias }] = Object.entries(contracts[c.table].dimensions).find(([key]) => key.endsWith("_GRP"))!;
      const totals = (await call(c.tool, { [alias]: "TOTAL", limit: 100 })).data as Page;
      expect(totals.returned).toBeGreaterThan(0);
      expect(totals.results.every((r) => r[dimension] === "" && r[alias] === "TOTAL")).toBe(true);
      const original = fixture.dataSet.find((r) => String(r[dimension]).startsWith("<"))!;
      const group = (await call(c.tool, { [alias]: original[dimension], limit: 100 })).data as Page;
      expect(group.returned).toBeGreaterThan(0);
      expect(group.results).toContainEqual(expect.objectContaining(original));
      expect(group.results.every((r) => r[dimension] === original[dimension] && r[dimension + "Desc"] === original[dimension + "Desc"])).toBe(true);
      const param = service.tools.find((t) => t.name === c.tool)!.inputSchema.toJSONSchema() as { properties: Record<string, { description: string }> };
      expect(param.properties[alias].description).toContain("thresholds are HK$ thousand");
    },
  );

  it("bounds observation bytes without losing the continuation offset", async () => {
    const c = batch060[0];
    const f = fixture060(c.table);
    // Enlarge genuine source labels to exercise the shared byte bound, not a new fixture.
    f.dataSet = f.dataSet.slice(0, 3).map((r) => ({ ...r, INDDesc: String(r.INDDesc).repeat(600) }));
    f.header.count.noOfRecords = f.dataSet.length;
    fetchMock.mockResolvedValueOnce(Response.json(f));
    const first = (await call(c.tool, { limit: 100 })).data as Page;
    expect(first.returned).toBeGreaterThan(0); expect(first.returned).toBeLessThan(3);
    expect(first.nextOffset).toBe(first.returned);
    expect(first.results.reduce((total, r) => total + Buffer.byteLength(JSON.stringify(r)), 0)).toBeLessThanOrEqual(100_000);
    const next = (await call(c.tool, { limit: 100, offset: first.nextOffset })).data as Page;
    expect(next.results[0]).toEqual(expect.objectContaining([...f.dataSet].sort((a, b) => String(b.period).localeCompare(String(a.period)))[first.returned]));
  });
});
