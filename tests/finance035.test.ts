import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { rankTools } from "@/lib/agent/tool-search";
import { batch035, blocked035, definition035, fixture035 } from "./finance035-cases";

const fetchMock = vi.fn<typeof fetch>();
async function call(name: string, input: Record<string, unknown> = {}) {
  const { service, tool } = definition035(name);
  return executeTool(service, tool, input);
}
function respond(file: string) { fetchMock.mockImplementation(async () => new Response(fixture035(file))); }
beforeEach(() => {
  const store = new Map<string, unknown>();
  setCacheForTesting({ get: async (key) => store.get(key) ?? null, set: async (key, value) => void store.set(key, value), delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); setCacheForTesting(null); });

describe("Finance batch 035", () => {
  it("owns exactly the verified stable IDs and never falsely registers blocked sources", () => {
    const added = services.filter((s) => batch035.some((c) => c.service === s.id));
    expect(added.flatMap((s) => s.apis).sort()).toEqual(batch035.filter((c) => !blocked035.includes(c.api)).map((c) => c.api).sort());
    for (const c of batch035) {
      expect(services.filter((s) => s.apis.includes(c.api))).toHaveLength(blocked035.includes(c.api) ? 0 : 1);
      expect(definition035(c.tool).tool).toBeDefined();
    }
    expect(added.flatMap((s) => s.datasets)).toHaveLength(6);
  });

  it.each(batch035)("validates inputs before network: $tool", async (c) => {
    const invalid: Record<string, unknown>[] = [{ limit: 0 }, { limit: 101 }, { limit: 1.5 }, { offset: -1 }, { offset: 1000001 }, { offset: 0.5 }];
    if (definition035(c.tool).tool.spec.input.lang) invalid.push({ lang: "fr" });
    for (const input of invalid) {
      await expect(call(c.tool, { ...c.input, ...input })).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(batch035)("parses fixture and bounds output: $tool", async (c) => {
    respond(c.fixture);
    const result = await call(c.tool, { ...c.input, limit: 3 });
    expect(result.data).toMatchObject({ returned: expect.any(Number), results: expect.any(Array) });
    expect((result.data as { returned: number }).returned).toBeGreaterThan(0);
    expect((result.data as { returned: number }).returned).toBeLessThanOrEqual(3);
    expect(result.meta.source).toMatch(/^https:\/\//);
    const url = new URL(String(fetchMock.mock.lastCall![0]));
    if (c.service === "hkma-finance") expect(url.searchParams.get("pagesize")).toBe("3");
    else expect(url.searchParams.has("limit")).toBe(false);
    expect(fetchMock.mock.lastCall![1]).toMatchObject({ cache: "no-store", signal: expect.any(AbortSignal) });
  });

  it.each(batch035)("handles HTTP, invalid body, network and timeout failures: $tool", async (c) => {
    setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
    for (const status of [405, 503]) {
      fetchMock.mockResolvedValueOnce(new Response(status === 405 ? "<html>Request blocked</html>" : "Maintenance", { status }));
      await expect(call(c.tool, c.input)).rejects.toMatchObject({ code: "upstream_http", status });
    }
    fetchMock.mockResolvedValueOnce(new Response("<html>Maintenance</html>"));
    await expect(call(c.tool, c.input)).rejects.toMatchObject({ code: "upstream_parse" });
    fetchMock.mockRejectedValueOnce(new TypeError("unreachable"));
    await expect(call(c.tool, c.input)).rejects.toMatchObject({ code: "upstream_network" });
    fetchMock.mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
    await expect(call(c.tool, c.input)).rejects.toMatchObject({ code: "upstream_timeout" });
  });

  it.each(batch035.filter((c) => c.service === "hkma-finance"))("rejects provider errors and malformed envelopes/rows: $tool", async (c) => {
    const fixture = JSON.parse(fixture035(c.fixture));
    for (const body of [null, [], {}, { header: { success: false, err_code: "E1" } },
      { ...fixture, result: { datasize: -1, records: [] } }, { ...fixture, result: { datasize: 2, records: [fixture.result.records[0]] } },
      { ...fixture, result: { datasize: 1, records: [null] } }, { ...fixture, result: { datasize: 1, records: [{}] } }]) {
      fetchMock.mockResolvedValueOnce(Response.json(body));
      await expect(call(c.tool, c.input)).rejects.toMatchObject({ code: "upstream_parse" });
    }
  });

  it.each(batch035.filter((c) => c.service === "hkma-finance"))("keeps upstream page offsets and empty-page termination: $tool", async (c) => {
    const fixture = JSON.parse(fixture035(c.fixture));
    const n = fixture.result.records.length;
    fetchMock.mockResolvedValueOnce(Response.json(fixture));
    expect((await call(c.tool, { ...c.input, limit: n, offset: 10 })).data).toMatchObject({ hasMore: true, nextOffset: 10 + n, results: fixture.result.records });
    fetchMock.mockResolvedValueOnce(Response.json({ ...fixture, result: { datasize: 0, records: [] } }));
    expect((await call(c.tool, { ...c.input, limit: n, offset: 10 + n })).data).toMatchObject({ hasMore: false, nextOffset: null, returned: 0 });
  });

  it("validates real calendar dates, forwards fixed date columns and HIBOR segment", async () => {
    for (const input of [{ from: "2026-02-30" }, { from: "2026-13-01" }, { from: "2026-02-01", to: "2026-01-01" }]) await expect(call("hkma_hibor", input)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    respond("hkma_hibor.json");
    await call("hkma_hibor", { from: "2026-09-01", to: "2026-09-30" });
    const url = new URL(String(fetchMock.mock.lastCall![0]));
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ from: "2026-09-01", to: "2026-09-30", column: "end_of_day", segment: "hibor.fixing", sortorder: "desc" });
    expect((await call("hkma_hibor", { from: "2026-09-01", to: "2026-09-30" })).data).toMatchObject({ results: expect.arrayContaining([expect.objectContaining({ ir_9m: null })]) });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses documented staff search modes and broker language segments", async () => {
    respond("hkma_securities_staff.json");
    for (const [searchType, key] of [["engName", "surname"], ["chiName", "chinesename"], ["regNo", "reg_code"]]) {
      await call("hkma_securities_staff", { searchType, search: "測試", lang: "tc" });
      const url = new URL(String(fetchMock.mock.lastCall![0]));
      expect(url.searchParams.get(key)).toBe("測試");
      expect(url.searchParams.get("searchtype")).toBe(searchType);
      expect(url.searchParams.get("is_curr_rel_indiv")).toBe("0");
    }
    await call("hkma_securities_staff", { searchType: "regNo", search: "AB0000", current: "1" });
    expect(new URL(String(fetchMock.mock.lastCall![0])).searchParams.get("is_curr_rel_indiv")).toBe("1");
    await expect(call("hkma_securities_staff", { search: "X", current: "2" })).rejects.toThrow();
    await expect(call("hkma_securities_staff", { search: "X", lang: "sc" })).rejects.toThrow();
    respond("hkma_money_brokers.json");
    await call("hkma_money_brokers", { lang: "tc" });
    expect(new URL(String(fetchMock.mock.lastCall![0])).searchParams.get("segment")).toBe("tc");
  });

  it("encodes Companies Registry searches without accepting arbitrary query syntax", async () => {
    respond("address-local.json");
    await call("cr_company_addresses", { field: "Comp_name", operator: "begins_with", value: "中國 & query[0]=X" });
    const url = new URL(String(fetchMock.mock.lastCall![0]));
    expect(url.pathname.endsWith("/local/search")).toBe(true);
    expect(url.searchParams.get("query[0][key3]")).toBe("中國 & query[0]=X");
    expect(url.searchParams.has("query[0]")).toBe(false);
    respond("address-foreign.json");
    expect((await call("cr_company_addresses", { register: "foreign", value: "75698252" })).data).toMatchObject({ results: expect.arrayContaining([expect.objectContaining({ Brn: "75698252" })]) });
    expect(new URL(String(fetchMock.mock.lastCall![0])).pathname.endsWith("/foreign/search")).toBe(true);
    for (const input of [{}, { value: " " }, { value: "X", register: "other" }, { value: "XX", field: "url" }]) await expect(call("cr_company_addresses", input)).rejects.toThrow();
  });

  it("paginates, searches and caches complete bilingual TCSP files", async () => {
    respond("tcsp.csv");
    const first = (await call("cr_tcsp_licensees", { limit: 2 })).data as { results: unknown[]; nextOffset: number };
    const second = (await call("cr_tcsp_licensees", { limit: 2, offset: first.nextOffset })).data as typeof first;
    const all = (await call("cr_tcsp_licensees")).data as typeof first;
    expect([...first.results, ...second.results]).toEqual(all.results.slice(0, 4));
    expect((await call("cr_tcsp_licensees", { search: "富年", lang: "tc" })).data).toMatchObject({ returned: 1, results: [expect.objectContaining({ licence: "TC000002", name: "富年顧問有限公司" })] });
    expect((await call("cr_tcsp_licensees", { licence: "TC000002", lang: "sc" })).data).toMatchObject({ returned: 1, sourceLanguage: "en,tc" });
    expect((await call("cr_tcsp_licensees", { search: "no such company" })).data).toMatchObject({ total: 0, results: [], nextOffset: null });
    expect((await call("cr_tcsp_licensees", { offset: 99999 })).data).toMatchObject({ returned: 0, hasMore: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["en", "tc", "sc"])("parses localized Customs file %s, including empty trailing columns", async (lang) => {
    respond(`warehouse-${lang}.csv`);
    const data = (await call("customs_bonded_warehouses", { lang })).data as { results: { licence: string; type: string }[] };
    expect(data.results[0].licence).toBe(lang === "en" ? "3503" : "03503");
    expect(new Set(data.results.map((row) => row.type)).size).toBe(3);
    expect(String(fetchMock.mock.lastCall![0])).toContain(`/csv/${lang}/list_of_warehouse_${lang}.csv`);
    expect((await call("customs_bonded_warehouses", { lang, licence: data.results[0].licence })).data).toMatchObject({ returned: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["cr_tcsp_licensees", "customs_bonded_warehouses"])("rejects changed CSV headers, broken quotes and nonempty extra fields: %s", async (tool) => {
    const file = tool === "cr_tcsp_licensees" ? "tcsp.csv" : "warehouse-en.csv";
    for (const body of [fixture035(file).replace(/^[^,]+/, "Unexpected"), fixture035(file) + '\n"broken', fixture035(file).replace(/\r?\n/, ",unexpected\n")]) {
      // Use a different local cache for each raw upstream body.
      setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
      fetchMock.mockResolvedValueOnce(new Response(body));
      await expect(call(tool)).rejects.toMatchObject({ code: "upstream_parse" });
    }
  });

  it.each([["HKMA HIBOR daily", "hkma_hibor"], ["company registered office addresses", "cr_company_addresses"], ["TCSP licensees", "cr_tcsp_licensees"], ["bonded warehouses", "customs_bonded_warehouses"]])("discovers %s", (query, name) => {
    expect(rankTools(query, services.flatMap((s) => s.tools)).slice(0, 8)).toContain(name);
  });
});
