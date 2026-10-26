import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { services } from "@/generated/registry";
import manifest from "@/generated/manifest.json";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { rankTools } from "@/lib/agent/tool-search";
import { developmentResponse } from "@/lib/mcp/development-spatial";
import { batch090, call090, definition090, fixture090, request090 } from "./batch090-cases";

const fetchMock = vi.fn<typeof fetch>();
const noCache = () => setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
beforeEach(() => {
  const store = new Map<string, unknown>();
  setCacheForTesting({ get: async (k) => store.get(k) ?? null, set: async (k, v) => void store.set(k, v), delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); setCacheForTesting(null); });

describe("Batch090 historical census geography", () => {
  it("registers exactly API-0204–0213, joins original dataset IDs and indexes tools", () => {
    expect(services.find((s) => s.id === "censtatd-census-history")!.apis).toEqual(Array.from({ length: 10 }, (_, i) => `API-0${204 + i}`));
    const tracker = parse(readFileSync(new URL("../mcp/apis.yaml", import.meta.url), "utf8")) as { apis: { id: string; datasets: string[] }[] };
    for (const c of batch090) {
      expect(tracker.apis.find((a) => a.id === c.api)!.datasets).toEqual([c.dataset]);
      expect(services.filter((s) => s.apis.includes(c.api)).map((s) => s.id)).toEqual([c.service]);
      expect((manifest.datasets as Record<string, string[]>)[c.dataset]).toEqual([c.service]);
      expect(rankTools(c.tool.replaceAll("_", " "), services.flatMap((s) => s.tools))).toContain(c.tool);
      expect(createHash("sha256").update(readFileSync(new URL(`./fixtures/batch090/${c.file}.json`, import.meta.url))).digest("hex")).toBe(c.sha256);
    }
  });
  it.each(batch090)("preserves source values, suppression, bilingual names and shared cache: $api", async (c) => {
    const source = fixture090(c);
    fetchMock.mockResolvedValueOnce(Response.json(source));
    for (const [lang, field] of Object.entries(c.names)) {
      const result = await call090(c, { lang });
      expect(result.meta.source).toBe(request090(c));
      expect(result.data).toEqual({ language: lang, coordinateSystem: "WGS84 (longitude, latitude)",
        results: source.features.map((f: { attributes: Record<string, unknown> }) => ({ ...f.attributes, name: f.attributes[field] })),
        returned: 2, hasMore: true, nextOffset: 2 });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.lastCall![1]).toMatchObject({ signal: expect.any(AbortSignal), cache: "no-store" });
    expect(definition090(c).service.cacheTtl).toBe(3600);
  });
  it.each(batch090)("rejects invalid bounded inputs before fetch: $api", async (c) => {
    for (const input of [{ limit: 0 }, { limit: 101 }, { limit: 1.2 }, { offset: -1 }, { offset: 1000001 }, { offset: 0.5 }, { objectId: 0 }, { objectId: 2147483648 }, { objectId: 1.5 }, { lang: "sc" }, { lang: "fr" }, { bbox: "x" }, { bbox: "180,0,181,1" }, { bbox: "114,23,115,22" }, { geometry: "yes" }]) await expect(call090(c, input)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(batch090)("builds stable paginated intersection queries: $api", async (c) => {
    fetchMock.mockResolvedValueOnce(Response.json({ features: [], exceededTransferLimit: false }));
    await call090(c, { objectId: 7, bbox: "113,21,115,23", limit: 1, offset: 2, geometry: true, lang: "tc" });
    const q = new URL(String(fetchMock.mock.lastCall![0])).searchParams;
    expect(q.get("where")).toBe("1=1 AND OBJECTID=7");
    expect(q.get("resultRecordCount")).toBe("1"); expect(q.get("resultOffset")).toBe("2");
    expect(q.get("orderByFields")).toBe("OBJECTID ASC"); expect(q.get("geometry")).toBe("113,21,115,23");
    expect(q.get("inSR")).toBe("4326"); expect(q.get("returnGeometry")).toBe("true"); expect(q.has("lang")).toBe(false);
  });
  it.each(batch090)("handles empty pages, bounded geometry and continuation: $api", async (c) => {
    noCache();
    fetchMock.mockResolvedValueOnce(Response.json({ features: [], exceededTransferLimit: false }));
    expect((await call090(c, { offset: 1000000 })).data).toMatchObject({ results: [], returned: 0, hasMore: false, nextOffset: null });
    const source = fixture090(c); source.features = source.features.slice(0, 1);
    fetchMock.mockResolvedValueOnce(Response.json(source));
    const data = (await call090(c, { limit: 1, offset: 2, geometry: true })).data;
    const geometry = source.features[0].geometry;
    expect(data).toMatchObject({ results: [Buffer.byteLength(JSON.stringify(geometry)) > 20000 ? { geometryOmitted: expect.any(String) } : { geometry }], returned: 1, hasMore: true, nextOffset: 3 });
    expect(Buffer.byteLength(JSON.stringify(data))).toBeLessThan(101000);
    source.exceededTransferLimit = false;
    fetchMock.mockResolvedValueOnce(Response.json(source));
    expect((await call090(c, { geometry: false })).data).toMatchObject({ hasMore: false, nextOffset: null, results: [expect.not.objectContaining({ geometry: expect.anything() })] });
  });
  it.each(batch090)("reports failures without retry and rejects malformed records: $api", async (c) => {
    noCache();
    fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
    await expect(call090(c)).rejects.toMatchObject({ code: "upstream_http", status: 503 });
    fetchMock.mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
    await expect(call090(c)).rejects.toMatchObject({ code: "upstream_timeout" });
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(call090(c)).rejects.toMatchObject({ code: "upstream_network" });
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: 400, message: "Invalid query" } }));
    await expect(call090(c)).rejects.toMatchObject({ code: "upstream_http" });
    for (const body of [null, {}, { features: [null] }, { features: [{ attributes: {} }] }, { features: [], exceededTransferLimit: true }]) {
      fetchMock.mockResolvedValueOnce(Response.json(body)); await expect(call090(c)).rejects.toMatchObject({ code: "upstream_parse" });
    }
    fetchMock.mockResolvedValueOnce(new Response("<html>not JSON</html>"));
    await expect(call090(c)).rejects.toMatchObject({ code: "upstream_parse" });
    const broken = fixture090(c); delete broken.features[0].attributes[c.names.tc];
    fetchMock.mockResolvedValueOnce(Response.json(broken)); await expect(call090(c)).rejects.toMatchObject({ code: "upstream_parse" });
    broken.features[0].attributes[c.names.tc] = 99;
    fetchMock.mockResolvedValueOnce(Response.json(broken)); await expect(call090(c)).rejects.toMatchObject({ code: "upstream_parse" });
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });
  it.each(batch090)("rejects invalid polygon rings and wrong CRS: $api", async (c) => {
    noCache();
    const body = fixture090(c); body.spatialReference = { wkid: 2326 };
    fetchMock.mockResolvedValueOnce(Response.json(body)); await expect(call090(c, { geometry: true })).rejects.toMatchObject({ code: "upstream_parse" });
    body.spatialReference = { wkid: 4326 };
    body.features[0].geometry = { rings: [[[114,22],[114,23],[115,22],[115,23]]] };
    fetchMock.mockResolvedValueOnce(Response.json(body)); await expect(call090(c, { geometry: true })).rejects.toMatchObject({ code: "upstream_parse" });
  });
  it("preserves the 100 KB record limit and continuation after a byte-limited page", async () => {
    const c = batch090[0]; const { service, tool } = definition090(c);
    const contract = JSON.parse(readFileSync(new URL("../mcp/services/censtatd-census-history/contracts/0204.json", import.meta.url), "utf8"));
    const response = developmentResponse(contract); const body = fixture090(c);
    body.features[0].attributes.ssbg_eng = "x".repeat(60000); body.features[1].attributes.ssbg_eng = "x".repeat(60000);
    expect(await response(body, { lang: "tc", limit: 2, offset: 4, geometry: false }, { service, tool, fetchUpstream: vi.fn() })).toMatchObject({ returned: 1, nextOffset: 5, hasMore: true });
    body.features[0].attributes.ssbg_eng = "x".repeat(110000);
    await expect(Promise.resolve().then(() => response(body, { lang: "tc", limit: 2, offset: 0 }, { service, tool, fetchUpstream: vi.fn() }))).rejects.toMatchObject({ code: "upstream_parse" });
  });
});
