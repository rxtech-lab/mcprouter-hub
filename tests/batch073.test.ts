import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { rankTools } from "@/lib/agent/tool-search";
import { batch073, fixture073, request073 } from "./batch073-cases";

type Row = Record<string, unknown>;
type Page = { results: Row[]; returned: number; total?: number; hasMore: boolean; nextOffset: number | null };
const fetchMock = vi.fn<typeof fetch>();
export function definition073(name: string) {
  const service = services.find((s) => s.tools.some((t) => t.name === name))!;
  return { service, tool: service.tools.find((t) => t.name === name)! };
}
function call(name: string, input: Row = {}) {
  const { service, tool } = definition073(name);
  return executeTool(service, tool, input);
}
function noCache() { setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} }); }
beforeEach(() => {
  const store = new Map<string, unknown>();
  setCacheForTesting({ get: async (k) => store.get(k) ?? null, set: async (k, v) => void store.set(k, v), delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); setCacheForTesting(null); });

function sourceRows(file: string): Row[] {
  const body = fixture073(file) as Row;
  if (file === "2190" || file === "2430") return (body.features as { attributes: Row }[]).map((r) => r.attributes);
  if (file === "2414") return body.value as Row[];
  return file === "2418" ? body as unknown as Row[] : [body];
}
function empty(file: string) {
  const body = fixture073(file) as Row;
  if (file === "2190" || file === "2430") return { ...body, features: [], exceededTransferLimit: false };
  return file === "2414" ? { value: [] } : [];
}
describe("Batch073 verified subset", () => {
  it("owns exactly five unique APIs and leaves the four empty sources unregistered", () => {
    const retained = [...new Set(batch073.map((c) => c.service))].flatMap((id) => services.find((s) => s.id === id)!.apis).sort();
    expect(retained).toEqual(batch073.map((c) => c.api).sort());
    for (const c of batch073) {
      expect(services.filter((s) => s.apis.includes(c.api)).map((s) => s.id)).toEqual([c.service]);
      expect(definition073(c.tool).service.cacheTtl).toBe(3600);
      expect(rankTools(c.tool.replaceAll("_", " "), services.flatMap((s) => s.tools))).toContain(c.tool);
    }
    for (const api of ["API-2417", "API-2419", "API-2423", "API-2424"]) expect(services.filter((s) => s.apis.includes(api))).toEqual([]);
  });
  it.each(batch073)("preserves actual fixture source fields and sends the official request: $api", async (c) => {
    fetchMock.mockResolvedValueOnce(Response.json(fixture073(c.file)));
    const result = await call(c.tool);
    const data = result.data as Page;
    expect(result.meta.source).toBe(request073(c));
    expect(data.returned).toBe(sourceRows(c.file).length);
    sourceRows(c.file).forEach((row, i) => expect(data.results[i]).toMatchObject(row));
    expect(data.hasMore).toBe(false); expect(data.nextOffset).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.lastCall![1]).toMatchObject({ cache: "no-store", signal: expect.any(AbortSignal) });
  });
  it.each(batch073)("rejects invalid bounded inputs before network: $api", async (c) => {
    for (const input of [{ limit: 0 }, { limit: 101 }, { limit: 1.5 }, { offset: -1 }, { offset: 100001 }, { offset: 0.1 }]) await expect(call(c.tool, input)).rejects.toThrow();
    if (definition073(c.tool).tool.spec.input.lang) await expect(call(c.tool, { lang: "fr" })).rejects.toThrow();
    if (["2414", "2418"].includes(c.file)) for (const search of ["", "x".repeat(101), 1]) await expect(call(c.tool, { search })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(batch073)("reports HTTP, timeout, network and malformed errors without retry: $api", async (c) => {
    noCache();
    fetchMock.mockResolvedValueOnce(new Response("<html>maintenance</html>", { status: 503 }));
    await expect(call(c.tool)).rejects.toMatchObject({ code: "upstream_http", status: 503 });
    fetchMock.mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
    await expect(call(c.tool)).rejects.toMatchObject({ code: "upstream_timeout" });
    fetchMock.mockRejectedValueOnce(new Error("connection reset"));
    await expect(call(c.tool)).rejects.toMatchObject({ code: "upstream_network" });
    for (const body of [null, {}, [null], { value: [null] }, { features: [{ attributes: {} }] }]) {
      fetchMock.mockResolvedValueOnce(Response.json(body));
      await expect(call(c.tool)).rejects.toMatchObject({ code: "upstream_parse" });
    }
    fetchMock.mockResolvedValueOnce(new Response("not json"));
    await expect(call(c.tool)).rejects.toMatchObject({ code: "upstream_parse" });
    expect(fetchMock).toHaveBeenCalledTimes(9);
  });
  it.each(batch073.filter((c) => c.file !== "2420"))("handles legitimate empty datasets: $api", async (c) => {
    fetchMock.mockResolvedValueOnce(Response.json(empty(c.file)));
    expect((await call(c.tool)).data).toMatchObject({ returned: 0, results: [], hasMore: false, nextOffset: null });
  });
  it.each(batch073.filter((c) => ["2414", "2418", "2420"].includes(c.file)))("locally pages a cached body and reaches empty offsets: $api", async (c) => {
    fetchMock.mockResolvedValueOnce(Response.json(fixture073(c.file)));
    const rows = sourceRows(c.file);
    const all: Row[] = [];
    for (let offset = 0; offset < rows.length; offset++) {
      const page = (await call(c.tool, { limit: 1, offset })).data as Page;
      expect(page.returned).toBe(1); expect(page.results[0]).toMatchObject(rows[offset]); all.push(page.results[0]);
      expect(page.nextOffset).toBe(offset + 1 < rows.length ? offset + 1 : null);
    }
    expect(all).toHaveLength(rows.length);
    expect((await call(c.tool, { offset: 100000 })).data).toMatchObject({ returned: 0, nextOffset: null });
    if (c.file !== "2420") expect((await call(c.tool, { search: "unfindable literal xyz" })).data).toMatchObject({ total: 0, results: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("localizes company names and filters clusters while retaining all source languages and nulls", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(fixture073("2414")));
    const r = sourceRows("2414")[0];
    for (const lang of ["en", "tc", "sc"]) {
      const data = (await call("hkstp_companies", { lang, cluster: String(r.cluster), search: String(r.name_EN) })).data as Page;
      expect(data.results[0]).toMatchObject({ ...r, name: r[`name_${lang.toUpperCase()}`] });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(batch073.filter((c) => "dataset" in c))("preserves bilingual hours and coordinates, rejects ArcGIS errors and invalid geometry: $api", async (c) => {
    const fixture = fixture073(c.file) as { features: { attributes: Row; geometry: Row }[] };
    for (const lang of c.file === "2190" ? ["en", "tc", "sc"] : ["en", "tc"]) {
      fetchMock.mockResolvedValueOnce(Response.json(fixture));
      const result = (await call(c.tool, { lang })).data as Page;
      expect(result.results[0].geometry).toEqual(fixture.features[0].geometry);
      expect(result.results[0].name).toBe(fixture.features[0].attributes[c.file === "2190" ? `NAME_${lang.toUpperCase()}_` : lang === "en" ? "NameEN" : "NameTC"]);
      noCache();
    }
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: 400 } }));
    await expect(call(c.tool)).rejects.toMatchObject({ code: "upstream_http" });
    fixture.features[fixture.features.length - 1].geometry.x = 181;
    fetchMock.mockResolvedValueOnce(Response.json(fixture));
    await expect(call(c.tool)).rejects.toMatchObject({ code: "upstream_parse" });
  });
  it("validates all HKSTP rows before filtering or paging and rejects empty space statistics", async () => {
    noCache();
    const f = fixture073("2414") as { value: Row[] }; f.value[4].name_EN = 123;
    fetchMock.mockResolvedValueOnce(Response.json(f));
    await expect(call("hkstp_companies", { limit: 1, search: "unfindable" })).rejects.toMatchObject({ code: "upstream_parse" });
    const jobs = fixture073("2418") as Row[]; jobs[4].Post_Start_Date = "bad";
    fetchMock.mockResolvedValueOnce(Response.json(jobs));
    await expect(call("hkstp_jobs", { limit: 1 })).rejects.toMatchObject({ code: "upstream_parse" });
    fetchMock.mockResolvedValueOnce(Response.json({ item: "", value: null }));
    await expect(call("hkstp_lab_office_space")).rejects.toMatchObject({ code: "upstream_parse" });
  });
  it("bounds bytes without losing continuation", async () => {
    const f = fixture073("2414") as { value: Row[] };
    f.value = f.value.slice(0, 3).map((r) => ({ ...r, introduction_EN: "x".repeat(30000) }));
    fetchMock.mockResolvedValueOnce(Response.json(f));
    const first = (await call("hkstp_companies", { limit: 100 })).data as Page;
    expect(first.returned).toBeGreaterThan(0); expect(first.returned).toBeLessThan(3);
    expect(Buffer.byteLength(JSON.stringify(first.results))).toBeLessThan(100100);
    expect(first.nextOffset).toBe(first.returned);
    const all = [...first.results];
    let offset = first.nextOffset;
    while (offset !== null) {
      const next = (await call("hkstp_companies", { offset })).data as Page;
      expect(next.returned).toBeGreaterThan(0);
      expect(next.results[0]).toMatchObject(f.value[offset]);
      all.push(...next.results); offset = next.nextOffset;
    }
    expect(all).toHaveLength(3);
  });
});
