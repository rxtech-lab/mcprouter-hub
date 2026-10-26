import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import manifest from "@/generated/manifest.json";
import { rankTools } from "@/lib/agent/tool-search";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { contracts } from "@/mcp/services/censtatd-population-vital/contract";
import { normalize } from "@/mcp/services/censtatd-population-vital/handlers";
import { batch094, localized094, call094, fixture094, definition094 } from "./batch094-cases";

const fetchMock = vi.fn<typeof fetch>();
function noCache() { setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} }); }
beforeEach(() => {
  const store = new Map<string, unknown>();
  setCacheForTesting({ get: async (k) => store.get(k) ?? null, set: async (k, v) => void store.set(k, v), delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); setCacheForTesting(null); });

it("joins exactly API-0309–0318 to original datasets and discovers each tool", () => {
  const service = definition094(batch094[0]).service;
  expect(service.apis).toEqual(Array.from({ length: 10 }, (_, i) => `API-${String(309 + i).padStart(4, "0")}`));
  const tracker = parse(readFileSync("mcp/apis.yaml", "utf8"));
  for (const c of batch094) {
    expect(services.filter((s) => s.apis.includes(c.api)).map((s) => s.id)).toEqual([service.id]);
    expect(tracker.apis.find((a: { id: string }) => a.id === c.api).datasets).toEqual([c.dataset]);
    expect((manifest.datasets as Record<string, string[]>)[c.dataset]).toEqual([service.id]);
    expect(rankTools(c.tool.replaceAll("_", " "), services.flatMap((s) => s.tools))).toContain(c.tool);
  }
});

it.each(localized094)("preserves every sampled source value, types, units, notes, paging and cache: $api/$lang", async (c) => {
  const bytes = readFileSync(`tests/fixtures/batch094/${c.file}`);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(c.fixtureSha256);
  const body = fixture094(c);
  fetchMock.mockResolvedValueOnce(Response.json(body));
  const expected = [...body.dataSet].sort((a, b) => String(b.period).localeCompare(String(a.period)))
    .map((r) => ({ ...r, measure: contracts[c.table].units[c.lang][r.sv][r.svDesc] }));
  const all: unknown[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const result = await call094(c, { limit: 3, offset });
    expect(result.meta.source).toBe(c.url);
    const data = result.data as { results: unknown[]; returned: number; total: number; nextOffset: number | null };
    expect(data).toMatchObject({ table: c.table, title: body.header.title, notes: body.header.tablenote, source: body.header.source, language: c.lang });
    expect(data.returned).toBeGreaterThan(0); expect(data.returned).toBeLessThanOrEqual(3);
    expect(data.total).toBe(expected.length); all.push(...data.results); offset = data.nextOffset;
  }
  expect(all).toEqual(expected);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(definition094(c).service.cacheTtl).toBe(3600);
  expect(fetchMock.mock.lastCall![1]).toMatchObject({ signal: expect.any(AbortSignal), cache: "no-store" });
});

it.each(batch094)("validates inputs before fetching and sends only table/language: $api", async (c) => {
  const { tool } = definition094(c);
  for (const input of [{ limit: 0 }, { limit: 101 }, { limit: 1.2 }, { offset: -1 }, { offset: 1000001 }, { offset: 0.2 },
    { lang: "fr" }, { period: "202513" }, { period: "2025 OR 1=1" }, { indicator: "fake" }, { measure: "fake" }, { freq: "Q" },
    ...Object.keys(contracts[c.table].dimensions).map((d) => ({ [d]: "fake" }))]) await expect(call094(c, input)).rejects.toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
  fetchMock.mockResolvedValueOnce(Response.json(fixture094(c)));
  await call094(c, { limit: 1, offset: 2, period: "2025", indicator: tool.spec.input.indicator.enum![0] });
  const url = new URL(String(fetchMock.mock.lastCall![0]));
  expect([...url.searchParams.keys()]).toEqual(["id", "full_series", "lang"]);
});

it.each(localized094)("filters all codes, indicators and measures without losing types: $api/$lang", async (c) => {
  const body = fixture094(c); const contract = contracts[c.table];
  fetchMock.mockResolvedValueOnce(Response.json(body));
  for (const [dim, codes] of Object.entries(contract.dimensions)) {
    for (const code of codes) {
      const data = (await call094(c, { [dim]: code === "" ? "TOTAL" : code, limit: 100 })).data as { results: Record<string, unknown>[]; total: number };
      const expected = body.dataSet.filter((r: Record<string, unknown>) => Object.hasOwn(r, dim) && String(r[dim]) === code);
      expect(data.total).toBe(expected.length);
      expect(data.results.map((r) => r[dim])).toEqual(expected.map((r: Record<string, unknown>) => r[dim]));
    }
  }
  for (const [indicator, units] of Object.entries(contract.units[c.lang])) {
    for (const measure of new Set(Object.values(units))) {
      const data = (await call094(c, { indicator, measure, limit: 100 })).data as { results: Record<string, unknown>[]; total: number };
      const expected = body.dataSet.filter((r: Record<string, unknown>) => r.sv === indicator && units[String(r.svDesc)] === measure);
      expect(data.total).toBe(expected.length); expect(data.results.every((r) => r.measure === measure && r.sv === indicator)).toBe(true);
    }
  }
  const empty = (await call094(c, { period: "9999" })).data;
  expect(empty).toMatchObject({ total: 0, results: [], returned: 0, nextOffset: null, hasMore: false });
  const beyond = (await call094(c, { offset: 1000000 })).data;
  expect(beyond).toMatchObject({ total: body.dataSet.length, results: [], returned: 0, nextOffset: null, hasMore: false });
});

it.each(batch094)("reports provider, JSON, timeout and network failures without retry: $api", async (c) => {
  noCache();
  fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
  await expect(call094(c)).rejects.toMatchObject({ code: "upstream_http", status: 503 });
  fetchMock.mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
  await expect(call094(c)).rejects.toMatchObject({ code: "upstream_timeout" });
  fetchMock.mockRejectedValueOnce(new Error("offline"));
  await expect(call094(c)).rejects.toMatchObject({ code: "upstream_network" });
  fetchMock.mockResolvedValueOnce(new Response("<html>error</html>"));
  await expect(call094(c)).rejects.toMatchObject({ code: "upstream_parse" });
  fetchMock.mockResolvedValueOnce(Response.json({ header: { status: { code: 4, name: "Failure" } } }));
  await expect(call094(c)).rejects.toMatchObject({ code: "upstream_http" });
  expect(fetchMock).toHaveBeenCalledTimes(5);
});

it.each(batch094)("rejects malformed observations before filtering; accepts empty data: $api", async (c) => {
  noCache();
  const fixture = fixture094(c);
  const failures: unknown[] = [null, {}, { header: null }, { ...fixture, dataSet: null }, { ...fixture, dataSet: [null] },
    { ...fixture, header: { ...fixture.header, status: null } }, { ...fixture, header: { ...fixture.header, tablenote: [42] } }];
  for (const patch of [{ period: "202513" }, { freq: "Q" }, { sv: "unknown" }, { svDesc: "unknown" }, { figure: null }, { figure: "unknown" }, { sd_value: null }]) {
    failures.push({ ...fixture, dataSet: [{ ...fixture.dataSet[0], ...patch }] });
  }
  for (const dim of contracts[c.table].indicators[fixture.dataSet[0].sv]) {
    for (const value of [null, {}, "fake"]) failures.push({ ...fixture, dataSet: [{ ...fixture.dataSet[0], [dim]: value }] });
    const row = { ...fixture.dataSet[0] }; delete row[`${dim}Desc`]; failures.push({ ...fixture, dataSet: [row] });
  }
  for (const body of failures) {
    fetchMock.mockResolvedValueOnce(Response.json(body));
    await expect(call094(c, { period: "9999" })).rejects.toMatchObject({ code: "upstream_parse" });
  }
  fetchMock.mockResolvedValueOnce(Response.json({ ...fixture, dataSet: [] }));
  expect((await call094(c)).data).toMatchObject({ total: 0, results: [], hasMore: false, nextOffset: null });
  expect(fetchMock).toHaveBeenCalledTimes(failures.length + 1);
});

it("keeps absent SEX distinct from TOTAL; handles monthly/annual births and localized Rate/Ratio", async () => {
  const vital = batch094.find((c) => c.table === "115-01011")!;
  fetchMock.mockResolvedValueOnce(Response.json(fixture094(vital)));
  const result = (await call094(vital, { SEX: "TOTAL", limit: 100 })).data as { results: Record<string, unknown>[] };
  expect(result.results.every((r) => Object.hasOwn(r, "SEX") && r.SEX === "")).toBe(true);
  expect(result.results.some((r) => r.sv === "MMR")).toBe(false);
  expect(contracts[vital.table].units.tc.MMR["比率"]).toBe("Ratio");
  expect(contracts[vital.table].units.tc.CBR["比率"]).toBe("Rate");
  const births = batch094.find((c) => c.table === "115-01012A")!;
  fetchMock.mockResolvedValueOnce(Response.json(fixture094(births)));
  for (const freq of ["M", "Y"]) {
    const data = (await call094(births, { freq, limit: 100 })).data as { results: Record<string, unknown>[] };
    expect(data.results.length).toBeGreaterThan(0); expect(data.results.every((r) => r.freq === freq)).toBe(true);
    expect(data.results.every((r) => String(r.period).length === (freq === "M" ? 6 : 4))).toBe(true);
  }
});

it("enforces byte bound with correct continuation and rejects oversized individual records", async () => {
  const c = batch094[0]; const { service, tool } = definition094(c); const source = fixture094(c);
  const body = { ...source, dataSet: [0, 1].map(() => ({ ...source.dataSet[0], DCDesc: "x".repeat(60000) })) };
  const context = { service, tool, fetchUpstream: vi.fn() };
  expect(await normalize(body, { lang: "en", limit: 2, offset: 0 }, context)).toMatchObject({ returned: 1, hasMore: true, nextOffset: 1 });
  body.dataSet[0].DCDesc = "x".repeat(110000);
  await expect(Promise.resolve().then(() => normalize(body, { lang: "en" }, context))).rejects.toMatchObject({ code: "upstream_parse" });
});
