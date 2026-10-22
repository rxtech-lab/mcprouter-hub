import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { rankTools } from "@/lib/agent/tool-search";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { executeTool } from "@/lib/mcp/runtime";
import { cases027, definition027 } from "./health027-cases";

const fetchMock = vi.fn<typeof fetch>();
const call = (name: string, input: Record<string, unknown>) => { const { service, tool } = definition027(name); return executeTool(service, tool, input); };
beforeEach(() => {
  const cache = new Map<string, unknown>();
  setCacheForTesting({ get: async (k) => cache.get(k) ?? null, set: async (k, v) => void cache.set(k, v), delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { setCacheForTesting(null); vi.unstubAllGlobals(); });
describe("Health batch 027", () => {
  it("owns exactly the eight retained permanent IDs and datasets", () => {
    const selected = services.find((s) => s.id === "ha-health")!;
    expect(selected.apis.slice().sort()).toEqual(["API-1975","API-1976","API-0042","API-2439","API-2441","API-2445","API-2446","API-2448"].sort());
    expect(selected.datasets).toEqual([...new Set(cases027.map((c) => c.dataset))]);
    for (const c of cases027) expect(services.filter((s) => s.apis.includes(c.id))).toEqual([selected]);
    expect(selected.tools).toHaveLength(8);
    for (const c of cases027.filter((c) => c.input.lang === "en" && !c.input.table)) {
      expect(rankTools(c.title, selected.tools.map((t) => ({ name: t.name, description: t.description })))).toContain(c.tool);
    }
  });
  describe.each(cases027)("$file", (c) => {
    const rawRows = () => ["dhce","wws"].includes(c.kind) ? c.reply.features.map((f: { attributes: unknown }) => f.attributes) : c.reply;
    it("preserves the captured contract, localizes, pages, searches and caches", async () => {
      fetchMock.mockImplementation(async () => Response.json(c.reply));
      const first = (await call(c.tool,c.input)).data as { returned: number; results: Record<string, unknown>[]; total: number; nextOffset: number };
      expect(first).toMatchObject({ returned: 2, total: rawRows().length, nextOffset: 2 });
      expect((await call(c.tool,{...c.input,limit:1,offset:1})).data).toMatchObject({ results: first.results.slice(1), returned: 1, nextOffset: 2 });
      expect((await call(c.tool,{...c.input,offset:100000})).data).toMatchObject({ results: [], returned:0, hasMore:false, nextOffset:null });
      expect((await call(c.tool,{...c.input,search:"unmatchable-health027-value"})).data).toMatchObject({ results: [], total:0 });
      expect(fetchMock).toHaveBeenCalledTimes(1); expect(String(fetchMock.mock.calls[0][0])).toBe(c.url);
      expect(Buffer.byteLength(JSON.stringify(first))).toBeLessThan(85000);
      {
        expect(first.results[0]).toMatchObject(rawRows()[0]);
        if (["dhce","wws"].includes(c.kind)) {
          expect(first.results[0].name).toBe(rawRows()[0][c.input.lang === "en" ? "NameEN" : "NameTC"]);
          expect(first.results[0].longitude).toBe(c.reply.features[0].geometry.x);
        } else if (["cmctr","facilities"].includes(c.kind)) {
          const suffix = c.input.lang === "en" ? "eng" : c.input.lang;
          expect(first.results[0].name).toBe(rawRows()[0][`${c.kind === "cmctr" ? "CMCTR" : "institution"}_${suffix}`]);
        }
      }
      if ("Financial Year" in rawRows()[0]) {
        const year = rawRows()[0]["Financial Year"];
        const expected = rawRows().filter((r: Record<string, unknown>) => r["Financial Year"] === year);
        expect((await call(c.tool,{...c.input,year,limit:100})).data).toMatchObject({ results: expected, total: expected.length });
      }
      const term = String(first.results[0].name ?? rawRows()[0].cluster ?? rawRows()[0]["Financial Year"] ?? "");
      if (term) expect((await call(c.tool,{...c.input,search:term.slice(0,100),limit:100})).data).toMatchObject({ results: expect.arrayContaining([first.results[0]]) });
    });
    it("accepts valid empty datasets", async () => {
      const body = ["dhce","wws"].includes(c.kind) ? { features: [] } : [];
      fetchMock.mockResolvedValueOnce(Response.json(body));
      expect((await call(c.tool,c.input)).data).toMatchObject({ total:0, results:[], returned:0, hasMore:false, nextOffset:null });
    });
    it.each([[503,"upstream_http"],[200,"upstream_parse"]])("rejects HTML status %i without retries", async (status,code) => {
      fetchMock.mockResolvedValueOnce(new Response("<html>maintenance</html>",{status:Number(status)}));
      await expect(call(c.tool,c.input)).rejects.toMatchObject({code}); expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    it("rejects missing required source columns before local filters", async () => {
      let body: unknown;
      if (["dhce","wws"].includes(c.kind)) body={features:[{attributes:{},geometry:{x:114,y:22}}]};
      else body=[{}];
      fetchMock.mockResolvedValueOnce(Response.json(body));
      await expect(call(c.tool,{...c.input,search:"no-match"})).rejects.toMatchObject({code:"upstream_parse"});
    });
    it("rejects malformed caller input before network", async () => {
      for (const bad of [{limit:0},{limit:101},{offset:-1},{offset:1.5},{lang:"fr"},{search:"x".repeat(101)},...(c.input.table ? [{table:"unverified"}] : []),...(["ambulatory","inpatient","cmctr-throughput"].includes(c.kind) ? [{year:"2024"}] : [])]) {
        await expect(call(c.tool,{...c.input,...bad})).rejects.toThrow();
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });
    it("rejects arrays in every retained observed scalar column without validator changes", async () => {
      setCacheForTesting({get:async()=>null,set:async()=>{},delete:async()=>{},expireTag:async()=>{}});
      for (const field of Object.keys(rawRows()[0])) {
        const body = structuredClone(c.reply);
        const row = ["dhce","wws"].includes(c.kind) ? body.features[0].attributes : body[0];
        row[field] = [];
        fetchMock.mockResolvedValueOnce(Response.json(body));
        await expect(call(c.tool,c.input)).rejects.toMatchObject({code:"upstream_parse"});
      }
      expect(fetchMock).toHaveBeenCalledTimes(Object.keys(rawRows()[0]).length);
    });
  });
  it.each(cases027.filter((c) => ["dhce","wws"].includes(c.kind) && c.input.lang === "en"))("rejects incomplete/error layers and invalid coordinates for $tool", async (c) => {
    for (const body of [{error:{code:400,message:"Invalid query"}},{...c.reply,exceededTransferLimit:true},{...c.reply,features:[{...c.reply.features[0],geometry:{x:999,y:22}}]}]) {
      // Distinct injected response shapes each use a fresh cache key after cache reset.
      setCacheForTesting({get:async()=>null,set:async()=>{},delete:async()=>{},expireTag:async()=>{}});
      fetchMock.mockResolvedValueOnce(Response.json(body));
      await expect(call(c.tool,c.input)).rejects.toMatchObject({code:"error" in body ? "upstream_http" : "upstream_parse"});
    }
  });
});
