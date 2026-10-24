import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { rankTools } from "@/lib/agent/tool-search";
import { contracts } from "@/mcp/services/censtatd-commerce-industry/contract";
import { batch063, fixture063 } from "./batch063-cases";

const service = services.find((s) => s.id === "censtatd-commerce-industry")!;
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
describe("Commerce batch063", () => {
  it("registers exactly ten stable APIs and dataset IDs with unique ownership", () => {
    expect(service.apis).toEqual(batch063.map((c) => c.api));
    expect(service.datasets).toEqual(batch063.map((c) => `hk-censtatd-tablechart-${c.table.toLowerCase()}`));
    expect(service.tools.map((t) => t.name)).toEqual(batch063.map((c) => c.tool));
    for (const c of batch063) expect(services.filter((s) => s.apis.includes(c.api))).toEqual([service]);
    for (const d of service.datasets) expect(services.filter((s) => s.datasets.includes(d))).toEqual([service]);
    expect(service.cacheTtl).toBe(3600);
  });

  it.each(batch063)("validates bounded inputs before network for $api", async (c) => {
    const invalid: Record<string, unknown>[] = [{ limit: 0 }, { limit: 101 }, { limit: 1.1 }, { offset: -1 }, { offset: 100001 }, { offset: 0.1 },
      { lang: "fr" }, { period: "202513" }, { period: "2025Q1" }, { indicator: "invalid" }, { freq: "W" }, { measure: "invalid" }];
    if (contracts[c.table].frequencies.join() === "Y") invalid.push({ period: "202501" });
    for (const { input } of Object.values(contracts[c.table].dimensions)) invalid.push({ [input]: "invalid" });
    for (const input of invalid) await expect(call(c.tool, input)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(batch063)("preserves localized source observations, notes, units and flags for $api", async (c) => {
    for (const lang of ["en", "tc", "sc"]) {
      const fixture = fixture063(c.table, lang);
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

  it.each(batch063)("paginates and caches upstream resources independently of local filters for $api", async (c) => {
    const fixture = fixture063(c.table);
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

  it.each(batch063)("filters every supported dimension, measure, indicator and frequency for $api", async (c) => {
    const fixture = fixture063(c.table);
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

  it.each(batch063)("rejects malformed envelopes and observations, including beyond the returned page for $api", async (c) => {
    noCache();
    const f = fixture063(c.table);
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

  it.each(batch063)("handles empty datasets and all upstream failure types without retry for $api", async (c) => {
    noCache();
    const f = fixture063(c.table);
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

  it.each(batch063)("exposes $api to relevant tool discovery", (c) => {
    // A precise official table ID must identify its corresponding tool.
    expect(rankTools(c.table, services.flatMap((s) => s.tools)).slice(0, 8)).toContain(c.tool);
  });

  it("keeps monetary, count and annual percentage-change measures distinct", () => {
    for (const c of batch063) {
      expect(contracts[c.table].indicatorUnits.HC).toContain("Number");
      expect(contracts[c.table].indicatorUnits.HC).not.toContain("HK$ million");
      expect(contracts[c.table].seasonallyAdjusted).toBe(false);
      expect(contracts[c.table].indexReferencePeriod).toBeNull();
    }
    expect(contracts["635-74002"].indicatorUnits.HC).toContain("Year-on-year % change");
    expect(contracts["640-75101"].indicatorUnits.HC).toContain("Year-on-year % change");
    expect(contracts["635-74003"].dimensions.PE_GRP.codes).toContain("100-499");
    expect(contracts["640-75102"].dimensions.PE_GRP.codes).toContain("200_and_over");
  });

  it("preserves every industry and official size-group code", async () => {
    for (const c of batch063.filter((entry) => Object.keys(contracts[entry.table].dimensions).length)) {
      fetchMock.mockResolvedValueOnce(Response.json(fixture063(c.table)));
      for (const [dimension, { input: alias, codes }] of Object.entries(contracts[c.table].dimensions)) {
        for (const code of codes) {
          const data = (await call(c.tool, { [alias]: code || "TOTAL", limit: 100 })).data as Page;
          expect(data.returned).toBeGreaterThan(0);
          expect(data.results.every((r) => String(r[dimension]) === code && r[alias] === (code || "TOTAL"))).toBe(true);
        }
      }
    }
  });

  it("bounds bytes while preserving continuation and source labels", async () => {
    const c = batch063[1];
    const f = fixture063(c.table);
    f.dataSet = f.dataSet.slice(0, 3).map((r) => ({ ...r, INDDesc: String(r.INDDesc).padEnd(45000, "x") }));
    f.header.count.noOfRecords = f.dataSet.length;
    fetchMock.mockResolvedValueOnce(Response.json(f));
    const first = (await call(c.tool, { limit: 100 })).data as Page;
    expect(first.returned).toBe(2); expect(first.nextOffset).toBe(2);
    expect(first.results.reduce((n, r) => n + Buffer.byteLength(JSON.stringify(r)), 0)).toBeLessThanOrEqual(100_000);
    const next = (await call(c.tool, { limit: 100, offset: first.nextOffset })).data as Page;
    expect(next.results[0]).toEqual(expect.objectContaining([...f.dataSet].sort((a, b) => String(b.period).localeCompare(String(a.period)))[2]));
    expect(next.nextOffset).toBeNull();
  });
});
