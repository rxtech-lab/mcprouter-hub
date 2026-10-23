import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { rankTools } from "@/lib/agent/tool-search";
import { contracts } from "@/mcp/services/censtatd-business-surveys/contract";
import { batch053, cases053, fixture053 } from "./batch053-cases";

const service = services.find((s) => s.id === "censtatd-business-surveys")!;
const fetchMock = vi.fn<typeof fetch>();
function call(name: string, input: Record<string, unknown> = {}) {
  return executeTool(service, service.tools.find((t) => t.name === name)!, input);
}
beforeEach(() => {
  const cache = new Map<string, unknown>();
  setCacheForTesting({ get: async (key) => cache.get(key) ?? null, set: async (key, value) => void cache.set(key, value), delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset();vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals();setCacheForTesting(null); });
it("owns exactly the ten requested IDs, datasets and tools", () => {
  const ids = Array.from({ length: 10 }, (_, i) => `API-${586 + i}`.replace("API-", "API-0"));
  expect(service.apis).toEqual(ids);
  expect(service.datasets).toEqual(batch053.map(([t]) => `hk-censtatd-tablechart-${t}`));
  expect(service.tools.map((t) => t.name)).toEqual(batch053.map(([, t]) => t));
  for (const id of ids) expect(services.filter((s) => s.apis?.includes(id))).toEqual([service]);
});
it.each(cases053)("filters all dimensions and preserves exact observations: $table", async (c) => {
  fetchMock.mockResolvedValueOnce(Response.json(c.reply));
  expect((await call(c.tool, c.input)).data).toEqual(c.data);
  expect(String(fetchMock.mock.lastCall![0])).toBe(c.request.url);
});
it.each(batch053)("preserves every localized observation and pages without loss: %s", async (table, tool) => {
  for (const lang of ["en", "tc", "sc"]) {
    const fixture = fixture053(table, lang);
    fetchMock.mockResolvedValueOnce(Response.json(fixture));
    const collected: unknown[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const data = (await call(tool, { lang, limit: 7, offset })).data as { results: Record<string, unknown>[]; nextOffset: number | null };
      expect(data).toMatchObject({ title: fixture.header.title, source: fixture.header.source, notes: fixture.header.tablenote, language: lang, total: fixture.dataSet.length });
      collected.push(...data.results);offset = data.nextOffset;
    }
    const expected = fixture.dataSet.map((r): Record<string, unknown> => ({ ...r, measure: contracts[table].units[r.svDesc],
      ...Object.fromEntries(Object.entries(contracts[table].dimensions).map(([key, dim]) => [dim.input, String(r[key]) || "TOTAL"])) }))
      .sort((a, b) => String(b.period).localeCompare(String(a.period)));
    expect(collected).toEqual(expected);
    expect(String(fetchMock.mock.lastCall![0])).toContain(`lang=${lang}`);
  }
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
it.each(batch053)("checks every filter, empty results, defaults and cache: %s", async (table, tool) => {
  const fixture = fixture053(table);
  fetchMock.mockImplementation(async () => Response.json(fixture));
  for (const [key, dim] of Object.entries(contracts[table].dimensions)) {
    for (const code of dim.codes) {
      const data = (await call(tool, { [dim.input]: code || "TOTAL", limit: 100 })).data as { results: Record<string, unknown>[]; total: number };
      const expected = fixture.dataSet.filter((r) => String(r[key]) === code);
      expect(data.total).toBe(expected.length);
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.results.every((r) => String(r[key]) === code)).toBe(true);
    }
  }
  for (const indicator of contracts[table].indicators) {
    const data = (await call(tool, { indicator })).data as { results: Record<string, unknown>[] };
    expect(data.results.length).toBeGreaterThan(0);expect(data.results.every((r) => r.sv === indicator)).toBe(true);
  }
  const year = String(fixture.dataSet[0].period).slice(0, 4);
  expect((await call(tool, { period: year })).data).toMatchObject({ total: fixture.dataSet.filter((r) => String(r.period).startsWith(year)).length });
  expect((await call(tool, { period: "1900" })).data).toMatchObject({ total: 0, results: [], hasMore: false, nextOffset: null });
  expect((await call(tool, { offset: 100000 })).data).toMatchObject({ returned: 0, hasMore: false });
  expect((await call(tool)).data).toMatchObject({ returned: Math.min(50, fixture.dataSet.length) });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it.each(batch053)("rejects malformed input before HTTP: %s", async (table, tool) => {
  const invalid: Record<string, unknown>[] = [{ limit: 0 }, { limit: 101 }, { limit: 1.5 }, { offset: -1 }, { offset: 100001 }, { lang: "fr" }, { indicator: "unknown" }, { period: "202613" }, { period: "2026-09" }];
  if (contracts[table].freq === "Q") invalid.push({ period: "202601" });
  for (const dim of Object.values(contracts[table].dimensions)) invalid.push({ [dim.input]: "unknown" });
  for (const input of invalid) await expect(call(tool, input)).rejects.toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
});
it.each(batch053)("reports HTTP, JSON, provider, malformed and network failures: %s", async (table, tool) => {
  setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
  const fixture = fixture053(table);const row = fixture.dataSet[0];
  const malformedRows: unknown[] = [null, [], { ...row, period: "202613" }, { ...row, figure: {} }, { ...row, freq: "Y" }, { ...row, sv: "unknown" }, { ...row, svDesc: "unknown" }, { ...row, sd_value: null }];
  for (const dim of Object.keys(contracts[table].dimensions)) {
    malformedRows.push({ ...row, [dim]: undefined }, { ...row, [dim]: {} }, { ...row, [dim]: "unknown" }, { ...row, [`${dim}Desc`]: undefined });
  }
  const bodies = [null, {}, { ...fixture, header: null }, { ...fixture, header: { ...fixture.header, status: { code: 1, name: "Fail" } } },
    { ...fixture, header: { ...fixture.header, tablenote: [null] } }, { header: fixture.header }, ...malformedRows.map((r) => ({ ...fixture, dataSet: [r] }))];
  for (const body of bodies) {
    fetchMock.mockResolvedValueOnce(Response.json(body));
    await expect(call(tool)).rejects.toMatchObject({ code: "upstream_parse" });
  }
  fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
  await expect(call(tool)).rejects.toMatchObject({ code: "upstream_http" });
  fetchMock.mockResolvedValueOnce(new Response("<html>maintenance</html>"));
  await expect(call(tool)).rejects.toMatchObject({ code: "upstream_parse" });
  fetchMock.mockRejectedValueOnce(new Error("Connection refused"));
  await expect(call(tool)).rejects.toMatchObject({ code: "upstream_network" });
  fetchMock.mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"));
  await expect(call(tool)).rejects.toMatchObject({ code: "upstream_timeout" });
  fetchMock.mockResolvedValueOnce(Response.json({ ...fixture, dataSet: [] }));
  expect((await call(tool)).data).toMatchObject({ total: 0, returned: 0, results: [], hasMore: false, nextOffset: null });
});
it("preserves synthetic missing figures and revision flags without numeric coercion", async () => {
  const fixture = fixture053("330-41001");
  fixture.dataSet = ["", "-12.5", -4].map((figure) => ({ ...fixture.dataSet[0], figure, sd_value: "P" }));
  fetchMock.mockResolvedValueOnce(Response.json(fixture));
  expect((await call("business_expected_situation")).data).toMatchObject({ results: fixture.dataSet.map((r) => expect.objectContaining(r)) });
});
it.each(batch053)("is discoverable by table number: %s", (table, tool) => {
  const candidates = services.flatMap((s) => s.tools.map(({ name, description }) => ({ name, description })));
  expect(rankTools(table, candidates).slice(0, 5)).toContain(tool);
});
