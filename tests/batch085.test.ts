import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { services } from "@/generated/registry";
import manifest from "@/generated/manifest.json";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { rankTools } from "@/lib/agent/tool-search";
import { batch085, call085, definition085, fixture085, request085 } from "./batch085-cases";

const fetchMock = vi.fn<typeof fetch>();
const noCache = () => setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
beforeEach(() => {
  const store = new Map<string, unknown>();
  setCacheForTesting({ get: async (k) => store.get(k) ?? null, set: async (k, v) => void store.set(k, v), delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); setCacheForTesting(null); });

describe("Batch085 land case contracts", () => {
  it("registers exactly ten IDs with the original dataset mapping", () => {
    const retained = [...batch085.map((c) => c.api), "API-3081"].sort();
    expect(services.filter((s) => ["landsd-land-cases", "landsd-topographic"].includes(s.id)).flatMap((s) => s.apis).sort()).toEqual(retained);
    for (const c of batch085) {
      expect(services.filter((s) => s.apis.includes(c.api)).map((s) => s.id)).toEqual([c.service]);
      expect((manifest.datasets as Record<string, string[]>)[c.dataset]).toEqual([c.service]);
      expect(rankTools(c.tool.replaceAll("_", " "), services.flatMap((s) => s.tools))).toContain(c.tool);
      expect(createHash("sha256").update(readFileSync(new URL(`./fixtures/batch085/${c.file}.json`, import.meta.url))).digest("hex")).toBe(c.sha256);
    }
  });
  it.each(batch085)("preserves real source records, languages and cache for $api", async (c) => {
    const source = fixture085(c);
    fetchMock.mockResolvedValueOnce(Response.json(source));
    for (const [lang, field] of Object.entries(c.names)) {
      const result = await call085(c, { lang });
      expect(result.meta.source).toBe(request085(c));
      const rows = source.features.map((f: { attributes: Record<string, unknown>; geometry: unknown }) => ({ ...f.attributes, name: f.attributes[field!], ...(Buffer.byteLength(JSON.stringify(f.geometry)) > 20000 ? { geometryOmitted: expect.any(String) } : { geometry: f.geometry }) }));
      expect(result.data).toEqual({ language: lang, coordinateSystem: "WGS84 (longitude, latitude)", results: rows, returned: 2, hasMore: true, nextOffset: 2 });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.lastCall![1]).toMatchObject({ signal: expect.any(AbortSignal), cache: "no-store" });
  });
  it.each(batch085)("rejects malformed or unsupported inputs before fetch: $api", async (c) => {
    for (const input of [{ limit: 0 }, { limit: 101 }, { limit: 1.2 }, { offset: -1 }, { offset: 1000001 }, { offset: 0.5 }, { objectId: 0 }, { objectId: 2147483648 }, { objectId: 1.5 }, { lang: "sc" }, { lang: "fr" }, { search: "" }, { search: " " }, { search: "x".repeat(101) }, { searchField: "DROP TABLE" }, { bbox: "x" }, { bbox: "180,0,181,1" }, { bbox: "114,23,115,22" }]) await expect(call085(c, input)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(batch085)("builds stable bounded queries and escaped search: $api", async (c) => {
    fetchMock.mockResolvedValueOnce(Response.json({ features: [], exceededTransferLimit: false }));
    await call085(c, { search: "O'Brien%_", objectId: 7, bbox: "113,21,115,23", limit: 1, offset: 2, geometry: false });
    const q = new URL(String(fetchMock.mock.lastCall![0])).searchParams;
    expect(q.get("where")).toBe(`1=1 AND OBJECTID=7 AND UPPER(${c.names.en}) LIKE '%O''BRIEN%_%'`);
    expect(q.get("resultRecordCount")).toBe("1"); expect(q.get("resultOffset")).toBe("2");
    expect(q.get("orderByFields")).toBe("OBJECTID ASC"); expect(q.get("geometry")).toBe("113,21,115,23");
    expect(q.get("inSR")).toBe("4326"); expect(q.get("returnGeometry")).toBe("false");
  });
  it.each(batch085)("handles empty pages, continuation and geometry omission: $api", async (c) => {
    noCache();
    fetchMock.mockResolvedValueOnce(Response.json({ features: [], exceededTransferLimit: false }));
    expect((await call085(c, { offset: 1000000 })).data).toMatchObject({ results: [], returned: 0, hasMore: false, nextOffset: null });
    const source = fixture085(c); source.features = source.features.slice(0, 1);
    fetchMock.mockResolvedValueOnce(Response.json(source));
    const data = (await call085(c, { limit: 1, offset: 2 })).data;
    expect(data).toMatchObject({ returned: 1, hasMore: true, nextOffset: 3 });
    expect(Buffer.byteLength(JSON.stringify(data))).toBeLessThan(101000);
    fetchMock.mockResolvedValueOnce(Response.json(source));
    expect((await call085(c, { geometry: false })).data).toMatchObject({ results: [expect.not.objectContaining({ geometry: expect.anything() })] });
  });
  it.each(batch085)("propagates provider errors without retries and rejects malformed records: $api", async (c) => {
    noCache();
    fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
    await expect(call085(c)).rejects.toMatchObject({ code: "upstream_http", status: 503 });
    fetchMock.mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
    await expect(call085(c)).rejects.toMatchObject({ code: "upstream_timeout" });
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(call085(c)).rejects.toMatchObject({ code: "upstream_network" });
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: 400, message: "Invalid query" } }));
    await expect(call085(c)).rejects.toMatchObject({ code: "upstream_http" });
    for (const body of [null, {}, { features: [null] }, { features: [{ attributes: {} }] }, { features: [], exceededTransferLimit: true }]) {
      fetchMock.mockResolvedValueOnce(Response.json(body)); await expect(call085(c)).rejects.toMatchObject({ code: "upstream_parse" });
    }
    fetchMock.mockResolvedValueOnce(new Response("<html>not JSON</html>"));
    await expect(call085(c)).rejects.toMatchObject({ code: "upstream_parse" });
    const broken = fixture085(c); delete broken.features[0].attributes[c.names.en];
    fetchMock.mockResolvedValueOnce(Response.json(broken)); await expect(call085(c)).rejects.toMatchObject({ code: "upstream_parse" });
    expect(fetchMock).toHaveBeenCalledTimes(11);
  });
  it.each(batch085)("rejects corrupt coordinates and wrong CRS: $api", async (c) => {
    noCache();
    const body = fixture085(c); body.spatialReference = { wkid: 2326 };
    fetchMock.mockResolvedValueOnce(Response.json(body)); await expect(call085(c)).rejects.toMatchObject({ code: "upstream_parse" });
    body.spatialReference = { wkid: 4326 };
    body.features[0].geometry = c.file === "3085" ? { rings: [[[114,22],[114,23],[115,22],[115,23]]] } : { x: 999, y: 22 };
    fetchMock.mockResolvedValueOnce(Response.json(body)); await expect(call085(c)).rejects.toMatchObject({ code: "upstream_parse" });
    expect(definition085(c).tool.spec.cacheTtl ?? definition085(c).service.cacheTtl).toBe(3600);
  });
});
