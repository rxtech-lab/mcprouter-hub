import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import manifest from "@/generated/manifest.json";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { rankTools } from "@/lib/agent/tool-search";
import { batch079, expected079, fixture079, layer079, request079, type Entry079 } from "./batch079-cases";
import type { ToolInput } from "@/lib/mcp/types";

const fetchMock = vi.fn<typeof fetch>();
const definition = (c: Entry079) => {
  const service = services.find((s) => s.id === c.service)!;
  return { service, tool: service.tools.find((t) => t.name === c.tool)! };
};
const call = (c: Entry079, input: ToolInput = {}) => { const { service, tool } = definition(c); return executeTool(service, tool, input); };
const noCache = () => setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
beforeEach(() => {
  const store = new Map<string, unknown>();
  setCacheForTesting({ get: async (k) => store.get(k) ?? null, set: async (k, v) => void store.set(k, v), delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); setCacheForTesting(null); });

describe("batch079 retained Development APIs", () => {
  it("registers exactly nine verified IDs and datasets, searchable by tool name", () => {
    const owned = services.filter((s) => ["gpa-properties", "had-boundaries"].includes(s.id));
    expect(owned.flatMap((s) => s.apis).sort()).toEqual(batch079.map((c) => c.api).sort());
    for (const c of batch079) {
      expect(services.filter((s) => s.apis.includes(c.api)).map((s) => s.id)).toEqual([c.service]);
      expect(owned.find((s) => s.id === c.service)!.datasets).toContain(c.dataset);
      expect((manifest.datasets as Record<string, string[]>)[c.dataset]).toEqual([c.service]);
      expect(rankTools(c.tool.replaceAll("_", " "), services.flatMap((s) => s.tools))).toContain(c.tool);
    }
  });
  it.each(batch079)("preserves source attributes including nulls and notices: $api", async (c) => {
    fetchMock.mockResolvedValueOnce(Response.json(fixture079(c.file, layer079(c))));
    expect(await call(c)).toEqual({ data: expected079(c), meta: { source: request079(c) } });
    expect(fetchMock.mock.lastCall![0]).toBe(request079(c));
    expect(fetchMock.mock.lastCall![1]).toMatchObject({ cache: "no-store", signal: expect.any(AbortSignal) });
    const again = await call(c);
    expect(again.data).toEqual(expected079(c)); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(batch079)("selects source language without translating or dropping other languages: $api", async (c) => {
    fetchMock.mockImplementation(async () => Response.json(fixture079(c.file, layer079(c))));
    for (const lang of Object.keys(c.names)) expect((await call(c, { lang })).data).toEqual(expected079(c, { lang }));
    expect(fetchMock).toHaveBeenCalledTimes(1); // Same upstream body cached for all aliases.
  });
  it.each(batch079)("rejects malformed bounded inputs without fetching: $api", async (c) => {
    for (const input of [{ limit: 0 }, { limit: 101 }, { limit: 1.2 }, { offset: -1 }, { offset: 1000001 }, { offset: 1.2 }, { lang: "fr" }, { objectId: 0 }, { objectId: 1.1 }, { objectId: 2147483648 }, { search: "" }, { search: "x".repeat(101) }, { search: "   " }, { searchField: "x;DROP" }, { bbox: "181,0,182,1" }, { bbox: "114,23,114,22" }, { bbox: "x" }]) {
      if (c.file === "2031" && "searchField" in input) continue; // No field selector on multi-schema history.
      await expect(call(c, input)).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(batch079)("builds escaped single-field search, exact OID and valid spatial filter: $api", async (c) => {
    fetchMock.mockResolvedValueOnce(Response.json({ features: [], exceededTransferLimit: false }));
    await call(c, { search: "O'Brien%_", objectId: 7, bbox: "113,21,115,23", geometry: false, limit: 1, offset: 2 });
    const url = new URL(String(fetchMock.mock.lastCall![0]));
    const name = c.file === "2031" ? "NAME_EN" : c.names.en;
    expect(url.searchParams.get("where")).toBe(`1=1 AND ${c.oid}=7 AND UPPER(${name}) LIKE '%O''BRIEN%_%'`);
    expect(url.searchParams.get("geometry")).toBe("113,21,115,23");
    expect(url.searchParams.get("spatialRel")).toBe("esriSpatialRelIntersects");
    expect(url.searchParams.get("orderByFields")).toBe(`${c.oid} ASC`);
    expect(url.searchParams.get("resultOffset")).toBe("2"); expect(url.searchParams.get("resultRecordCount")).toBe("1");
  });
  it.each(batch079)("propagates HTTP, timeout, network, ArcGIS and malformed errors without retries: $api", async (c) => {
    noCache();
    fetchMock.mockResolvedValueOnce(new Response("<html>maintenance</html>", { status: 503 }));
    await expect(call(c)).rejects.toMatchObject({ code: "upstream_http", status: 503 });
    fetchMock.mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
    await expect(call(c)).rejects.toMatchObject({ code: "upstream_timeout" });
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    await expect(call(c)).rejects.toMatchObject({ code: "upstream_network" });
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: 400, message: "Invalid query" } }));
    await expect(call(c)).rejects.toMatchObject({ code: "upstream_http" });
    for (const body of [null, {}, { features: [null] }, { features: [{ attributes: {} }] }, { features: [], exceededTransferLimit: true }]) {
      fetchMock.mockResolvedValueOnce(Response.json(body));
      await expect(call(c)).rejects.toMatchObject({ code: "upstream_parse" });
    }
    fetchMock.mockResolvedValueOnce(new Response("<html>not JSON</html>"));
    await expect(call(c)).rejects.toMatchObject({ code: "upstream_parse" });
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });
  it.each(batch079)("handles empty pages, pagination, geometry omission and malformed source fields: $api", async (c) => {
    noCache();
    fetchMock.mockResolvedValueOnce(Response.json({ features: [], exceededTransferLimit: false }));
    expect((await call(c, { offset: 1000000 })).data).toMatchObject({ results: [], returned: 0, hasMore: false, nextOffset: null });
    const body = fixture079(c.file, layer079(c));
    body.features = body.features.slice(0, 1); body.exceededTransferLimit = true;
    fetchMock.mockResolvedValueOnce(Response.json(body));
    const data = (await call(c, { limit: 1, offset: 2 })).data as { results: Record<string, unknown>[]; nextOffset: number };
    expect(data.nextOffset).toBe(3);
    expect(Buffer.byteLength(JSON.stringify(data.results))).toBeLessThan(100100);
    if (Buffer.byteLength(JSON.stringify(body.features[0].geometry)) > 20_000) expect(data.results[0]).toHaveProperty("geometryOmitted");
    else expect(data.results[0].geometry).toEqual(body.features[0].geometry);
    fetchMock.mockResolvedValueOnce(Response.json(body));
    expect(((await call(c, { geometry: false })).data as { results: unknown[] }).results[0]).not.toHaveProperty("geometry");
    const broken = fixture079(c.file, layer079(c));
    delete broken.features[0].attributes[c.file === "2031" ? "NAME_EN" : c.names.en!];
    fetchMock.mockResolvedValueOnce(Response.json(broken));
    await expect(call(c)).rejects.toMatchObject({ code: "upstream_parse" });
  });
  it.each(["1999", "2003", "2007", "2015"])("routes historical %s to the verified layer and schema", async (year) => {
    const c = batch079.find((c) => c.file === "2031")!;
    fetchMock.mockResolvedValueOnce(Response.json(fixture079(c.file, layer079(c, { year }))));
    expect(await call(c, { year })).toEqual({ data: expected079(c, { year }), meta: { source: request079(c, { year }) } });
    expect(fetchMock.mock.lastCall![0]).toBe(request079(c, { year }));
  });
  it("keeps the domestic-sale no-tender notice as published information", async () => {
    const c = batch079.find((c) => c.file === "1961")!;
    fetchMock.mockResolvedValueOnce(Response.json(fixture079(c.file)));
    const row = ((await call(c)).data as { results: Record<string, unknown>[] }).results[0];
    expect(row.en_remarks).toContain("no tender invitation");
    expect(definition(c).tool.description).toContain("not proof of an available property");
  });
  it.each(batch079)("rejects corrupt WGS84 geometry and mismatched coordinate systems: $api", async (c) => {
    noCache();
    const fixture = fixture079(c.file, layer079(c)); Object.assign(fixture.spatialReference, { wkid: 2326, latestWkid: 2326 });
    fetchMock.mockResolvedValueOnce(Response.json(fixture)); await expect(call(c)).rejects.toMatchObject({ code: "upstream_parse" });
    Object.assign(fixture.spatialReference, { wkid: 4326, latestWkid: 4326 });
    fixture.features[0].geometry = c.geometry === "esriGeometryPoint" ? { x: 181, y: 22 } : { rings: [[[114,22],[114,23],[115,23],[116,22]]] };
    fetchMock.mockResolvedValueOnce(Response.json(fixture)); await expect(call(c)).rejects.toMatchObject({ code: "upstream_parse" });
  });
});
