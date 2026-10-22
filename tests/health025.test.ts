import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { executeTool } from "@/lib/mcp/runtime";
import { rankTools } from "@/lib/agent/tool-search";
import { cases025, definition025, entries025 } from "./health025-cases";
const fetchMock = vi.fn<typeof fetch>();
const call = (name: string, input: Record<string, unknown> = {}) => { const { service, tool } = definition025(name); return executeTool(service, tool, input); };
beforeEach(() => {
  const cache = new Map<string, unknown>();
  setCacheForTesting({ get: async (k) => cache.get(k) ?? null, set: async (k, v) => void cache.set(k, v), delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { setCacheForTesting(null); vi.unstubAllGlobals(); });
describe("Health 025 retained subset", () => {
  it.each(entries025)("registers $id exactly once and exposes $tool in search", (c) => {
    const owners = services.filter((s) => s.apis.includes(c.id));
    expect(owners).toHaveLength(1); expect(owners[0].datasets).toContain(c.dataset);
    expect(rankTools(c.title, services.flatMap((s) => s.tools.map((t) => ({ name: t.name, description: t.description })))).slice(0, 8)).toContain(c.tool);
  });
  it("does not register the five failed metadata sources", () => {
    for (const id of [842,843,844,845,846]) expect(services.filter((s) => s.apis.includes(`API-0${id}`))).toEqual([]);
  });
  describe.each(cases025)("$tool $input.lang captured contract", (c) => {
    const respond = () => fetchMock.mockImplementation(async () => typeof c.reply === "string" ? new Response(c.reply) : Response.json(c.reply));
    it("preserves source rows, localizes, pages and caches the raw download", async () => {
      respond();
      const first = (await call(c.tool, c.input)).data as { results: Record<string, unknown>[]; returned: number; total: number; nextOffset: number };
      expect(first.returned).toBe(2); expect(first.nextOffset).toBe(2); expect(Buffer.byteLength(JSON.stringify(first))).toBeLessThan(105000);
      const second = await call(c.tool, { ...c.input, limit: 1, offset: 1 });
      expect(second.data).toMatchObject({ results: first.results.slice(1), returned: 1, nextOffset: 2 });
      expect((await call(c.tool, { ...c.input, offset: 100000 })).data).toMatchObject({ results: [], returned: 0, hasMore: false, nextOffset: null });
      expect((await call(c.tool, { ...c.input, search: "unmatchable-health025-value" })).data).toMatchObject({ results: [], total: 0 });
      expect(fetchMock).toHaveBeenCalledTimes(1); expect(String(fetchMock.mock.calls[0][0])).toBe(c.request.url);
      if (c.kind === "statistics") {
        const rows = c.reply.dataSet as Record<string, unknown>[];
        expect(first.total).toBe(rows.length); expect(rows).toContainEqual(first.results[0]);
        expect(first.results[0].period).toBe(rows.map((r) => String(r.period)).sort().at(-1));
        expect((await call(c.tool, { ...c.input, indicator: rows[0].sv, period: rows[0].period, freq: rows[0].freq })).data).toMatchObject({ results: expect.arrayContaining([rows[0]]) });
      } else if (c.kind === "clinics") {
        const a = c.reply.features[0].attributes; const suffix = { en: "EN", tc: "TC", sc: "SC" }[c.input.lang]!;
        expect(first.results[0]).toMatchObject({ ...a, name: a[`Name_${suffix}`], address: a[`Address_${suffix}`], longitude: c.reply.features[0].geometry.x });
      } else {
        expect(first.total).toBe(668); expect(first.results[0]).toMatchObject({ Year: "2026", Week: "42", H1: "837", AandB_proportion: "0.1004" });
        expect((await call(c.tool, { ...c.input, year: 2014, week: 1 })).data).toMatchObject({ results: [expect.objectContaining({ ILI_FMC: "", H1: "93" })] });
      }
    });
    it.each([["http",503,"upstream_http"],["html",200,"upstream_parse"],["malformed",200,"upstream_parse"]])("rejects %s without retries", async (kind, status, code) => {
      fetchMock.mockResolvedValueOnce(new Response(kind === "malformed" ? '{}' : '<html>maintenance</html>', { status: Number(status) }));
      await expect(call(c.tool, c.input)).rejects.toMatchObject({ code }); expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    it("rejects malformed inputs before network", async () => {
      for (const bad of [{limit:0},{limit:101},{offset:-1},{lang:"fr"},{search:"x".repeat(101)}, ...(c.kind === "statistics" ? [{period:"202613"},{indicator:"invalid"},{freq:"M"}] : c.kind === "flu" ? [{year:2013},{week:54}] : [])]) await expect(call(c.tool, {...c.input,...bad})).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    });
    it("validates malformed individual records and error envelopes", async () => {
      let body: unknown;
      if (c.kind === "statistics") body = { ...c.reply, dataSet: [{ ...c.reply.dataSet[0], figure: {} }] };
      else if (c.kind === "clinics") body = { features: [{ attributes: c.reply.features[0].attributes, geometry: { x: 999, y: 22 } }] };
      else body = String(c.reply).replace('2014,1,', '2014,54,');
      fetchMock.mockResolvedValueOnce(typeof body === "string" ? new Response(body) : Response.json(body));
      await expect(call(c.tool,c.input)).rejects.toMatchObject({code:"upstream_parse"});
    });
  });
  it("separates table language cache keys and reuses clinic language downloads", async () => {
    const table = cases025.find((c) => c.kind === "statistics")!;
    fetchMock.mockImplementation(async () => Response.json(table.reply));
    await call(table.tool,{lang:"en"}); await call(table.tool,{lang:"tc"}); expect(fetchMock).toHaveBeenCalledTimes(2);
    const clinic = cases025.find((c) => c.kind === "clinics")!; fetchMock.mockImplementation(async () => Response.json(clinic.reply));
    await call(clinic.tool,{lang:"en"}); await call(clinic.tool,{lang:"tc"}); expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
