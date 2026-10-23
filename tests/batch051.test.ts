import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { rankTools } from "@/lib/agent/tool-search";
import { batch051, definition051, fixture051 } from "./batch051-cases";

const fetchMock = vi.fn<typeof fetch>();
function noCache() { setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} }); }
function call(name: string, input: Record<string, unknown> = {}) {
  const { service, tool } = definition051(name);
  return executeTool(service, tool, input);
}
function respond(file: string) { fetchMock.mockImplementation(async () => new Response(fixture051(file))); }
beforeEach(() => {
  const store = new Map<string, unknown>();
  setCacheForTesting({ get: async (key) => store.get(key) ?? null, set: async (key, value) => void store.set(key, value), delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); setCacheForTesting(null); });

describe("Batch051 verified subset", () => {
  it("owns exactly nine requested IDs and datasets; the failed post office stays unregistered", () => {
    const added = [...new Set(batch051.map((c) => definition051(c.tool).service))];
    expect(added.flatMap((s) => s.apis).sort()).toEqual(batch051.map((c) => c.api).sort());
    expect(added.flatMap((s) => s.datasets)).toHaveLength(9);
    for (const c of batch051) expect(services.filter((s) => s.apis.includes(c.api))).toEqual([definition051(c.tool).service]);
    expect(services.some((s) => s.apis.includes("API-0050"))).toBe(false);
  });
  it.each(batch051)("rejects malformed inputs before HTTP: $tool", async (c) => {
    const { tool } = definition051(c.tool);
    for (const input of [{ limit: 0 }, { limit: 101 }, { limit: 1.5 }, { offset: -1 }, { offset: 100001 },
      ...(tool.spec.input.lang ? [{ lang: "fr" }] : []), ...(tool.spec.input.period ? [{ period: "2025Q1" }] : [])]) {
      await expect(call(c.tool, { ...c.input, ...input })).rejects.toThrow();
    }
    if (c.api === "API-0049") for (const q of ["", "  ", "a".repeat(201)]) await expect(call(c.tool, { q })).rejects.toThrow();
    if (["API-2598", "API-0051"].includes(c.api)) await expect(call(c.tool, { bbox: "10,20,5,30" })).rejects.toThrow(/bbox/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(batch051)("propagates HTTP, network and timeout errors: $tool", async (c) => {
    fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
    await expect(call(c.tool, c.input)).rejects.toMatchObject({ code: "upstream_http", status: 503 });
    fetchMock.mockRejectedValueOnce(new Error("Connection refused"));
    await expect(call(c.tool, c.input)).rejects.toMatchObject({ code: "upstream_network" });
    fetchMock.mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"));
    await expect(call(c.tool, c.input)).rejects.toMatchObject({ code: "upstream_timeout" });
  });
  it.each(batch051)("rejects malformed upstream envelopes: $tool", async (c) => {
    noCache();
    for (const body of ["<html>maintenance</html>", "null", "{}", "[]"]) {
      fetchMock.mockResolvedValueOnce(new Response(body));
      await expect(call(c.tool, c.input)).rejects.toMatchObject({ code: "upstream_parse" });
    }
  });
  it.each(batch051)("returns useful captured records and caches repeated requests: $tool", async (c) => {
    respond(c.file);
    const result = await call(c.tool, { ...c.input, limit: 3 });
    const data = result.data as { returned: number; results: unknown[] };
    expect(data.returned).toBe(c.api === "API-0049" ? 1 : 3);
    expect(data.results).toHaveLength(data.returned);
    expect(Buffer.byteLength(JSON.stringify(data))).toBeLessThan(110000);
    expect(await call(c.tool, { ...c.input, limit: 3 })).toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(batch051)("discovers $tool by its descriptive title", (c) => {
    const { tool } = definition051(c.tool);
    const candidates = services.flatMap((s) => s.tools.map(({ name, description }) => ({ name, description })));
    expect(rankTools(tool.title!, candidates).slice(0, 8)).toContain(c.tool);
  });
});

it.each(batch051.slice(0, 2))("preserves HKMA fields, nulls and page termination: $tool", async (c) => {
  noCache(); const fixture = JSON.parse(fixture051(c.file));
  fetchMock.mockResolvedValueOnce(Response.json(fixture));
  expect((await call(c.tool, { limit: 3, offset: 10 })).data).toMatchObject({ upstreamPageSize: 3, results: fixture.result.records, nextOffset: 13, hasMore: true });
  fetchMock.mockResolvedValueOnce(Response.json({ ...fixture, result: { datasize: 0, records: [] } }));
  expect((await call(c.tool, { limit: 3, offset: 13 })).data).toMatchObject({ returned: 0, nextOffset: null, hasMore: false });
  for (const result of [{ datasize: 9, records: fixture.result.records }, { datasize: 1, records: [{}] }, { datasize: 1, records: [null] }]) {
    fetchMock.mockResolvedValueOnce(Response.json({ ...fixture, result }));
    await expect(call(c.tool)).rejects.toMatchObject({ code: "upstream_parse" });
  }
  fetchMock.mockResolvedValueOnce(Response.json({ header: { success: false, err_code: "E1" } }));
  await expect(call(c.tool)).rejects.toThrow(/official HKMA/);
});

it("keeps bilingual ALS elements, scores and numeric coordinates; rejects malformed coordinates", async () => {
  respond("0049.json");
  const fixture = JSON.parse(fixture051("0049.json"));
  const data = (await call("hk_address_lookup", { q: "central government offices", lang: "tc" })).data as { results: unknown[] };
  expect(data.results[0]).toMatchObject({ ...fixture.SuggestedAddress[0], preferredAddress: { BuildingName: "政府總部" }, coordinates: [{ latitude: 22.28046, longitude: 114.16537 }] });
  expect((fetchMock.mock.lastCall![1]?.headers as Record<string, string>).Accept).toBe("application/json");
  noCache();
  const suggestion = fixture.SuggestedAddress[0];
  suggestion.Address.PremisesAddress.GeospatialInformation.Latitude = "invalid";
  fetchMock.mockResolvedValueOnce(Response.json(fixture));
  await expect(call("hk_address_lookup", { q: "central government offices" })).rejects.toMatchObject({ code: "upstream_parse" });
  fetchMock.mockResolvedValueOnce(Response.json({ RequestAddress: { AddressLine: ["No match"] }, SuggestedAddress: [] }));
  expect((await call("hk_address_lookup", { q: "No match" })).data).toMatchObject({ returned: 0, results: [], nextOffset: null });
});

it.each(batch051.filter((c) => ["API-2598", "API-0051"].includes(c.api)))("keeps spatial language, paging and encoded search: $tool", async (c) => {
  respond(c.file);
  const fixture = JSON.parse(fixture051(c.file));
  const first = fixture.features[0].attributes;
  const name = c.api === "API-2598" ? first.NAME_TC : first.NameTC;
  const data = (await call(c.tool, { lang: "tc", search: "a'b", limit: 3 })).data as { results: unknown[] };
  expect(data.results[0]).toMatchObject({ ...Object.fromEntries(Object.entries(first).filter(([, v]) => v !== null)), name, geometry: fixture.features[0].geometry });
  expect(new URL(String(fetchMock.mock.lastCall![0])).searchParams.get("where")).toContain("A''B");
  expect(data).toMatchObject({ nextOffset: 3 });
  noCache();
  for (const body of [{ error: { code: 400, message: "Invalid query" } }, { features: [{ attributes: {} }] }, { features: [null] }]) {
    fetchMock.mockResolvedValueOnce(Response.json(body));
    await expect(call(c.tool)).rejects.toThrow();
  }
  fetchMock.mockResolvedValueOnce(Response.json({ features: [], exceededTransferLimit: false }));
  expect((await call(c.tool)).data).toMatchObject({ returned: 0, nextOffset: null });
});

it("selects all three official RSS language endpoints and bounds summaries", async () => {
  for (const lang of ["en", "tc", "sc"]) {
    respond(`0052-${lang}.xml`);
    const data = (await call("hk_government_press_releases", { lang, limit: 1 })).data as { results: Array<{ title: string; summary: string }>; nextOffset: number };
    expect(data.results[0].title.length).toBeGreaterThan(0);
    expect(data.results[0].summary.length).toBeLessThanOrEqual(2000);
    expect(data.nextOffset).toBe(1);
    const url = String(fetchMock.mock.lastCall![0]);
    expect(url).toContain(lang === "sc" ? "sc.isd.gov.hk/TuniS/" : "www.info.gov.hk/gia/");
    expect(url).toContain(lang === "en" ? "general_en.xml" : "general_zh.xml");
  }
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect((await call("hk_government_press_releases", { search: "unmatchable-test-phrase" })).data).toMatchObject({ returned: 0, total: 0 });
  noCache();
  fetchMock.mockResolvedValueOnce(new Response('<rss><channel><title>Test</title><link>https://www.info.gov.hk</link><item><title>Bad</title><link>javascript:bad</link><pubDate>bad</pubDate></item></channel></rss>'));
  await expect(call("hk_government_press_releases")).rejects.toMatchObject({ code: "upstream_parse" });
});

it.each(batch051.slice(6))("preserves C&SD dimensions, measures, rounding notes and localization: $tool", async (c) => {
  for (const lang of ["en", "tc", "sc"]) {
    const file = c.file.replace("en.json", `${lang}.json`);respond(file);
    const fixture = JSON.parse(fixture051(file));
    const all = (await call(c.tool, { lang, limit: 100 })).data as { results: Record<string, unknown>[] };
    expect(all).toMatchObject({ title: fixture.header.title, notes: fixture.header.tablenote, language: lang });
    const expected = [...fixture.dataSet].sort((a, b) => b.period.localeCompare(a.period));
    expect(all.results.map(({ measure, ...row }) => { expect(["count", "percent"]).toContain(measure); return row; })).toEqual(expected);
    const first = all.results[0];
    expect((await call(c.tool, { lang, period: first.period, status: first.STATUS, measure: first.measure, ...(first.COUNTRY_PARENT ? { country: String(first.COUNTRY_PARENT) } : {}) })).data).toMatchObject({ results: expect.arrayContaining([first]) });
    expect((await call(c.tool, { lang, period: "0000" })).data).toMatchObject({ returned: 0, total: 0 });
  }
  expect(fetchMock).toHaveBeenCalledTimes(3);
  noCache();const fixture = JSON.parse(fixture051(c.file));
  for (const patch of [{ sv: "INVALID" }, { svDesc: "HK$ million" }, { period: "bad" }, { STATUS: null }, { figure: {} }, { sd_value: null }]) {
    fetchMock.mockResolvedValueOnce(Response.json({ ...fixture, dataSet: [{ ...fixture.dataSet[0], ...patch }] }));
    await expect(call(c.tool)).rejects.toMatchObject({ code: "upstream_parse" });
  }
});
