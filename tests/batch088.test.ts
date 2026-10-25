import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { services } from "@/generated/registry";
import generated from "@/generated/manifest.json";
import { rankTools } from "@/lib/agent/tool-search";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { batch088, call088, definition088, fixture088, request088 } from "./batch088-cases";
import hashes from "./fixtures/batch088/hashes.json";

const fetchMock = vi.fn<typeof fetch>();
const noCache = () => setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
beforeEach(() => {
  const store = new Map<string, unknown>();
  setCacheForTesting({ get: async (k) => store.get(k) ?? null, set: async (k, v) => void store.set(k, v), delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); setCacheForTesting(null); });

it("registers exactly the nine retained permanent IDs and hashes actual captures", () => {
  const service = definition088(batch088[0].tool).service;
  expect([...service.apis].sort()).toEqual([3361,3362,3363,3366,3369,3616,3617,3618,3621].map((i) => `API-${i}`).sort());
  for (const c of batch088) {
    expect(services.filter((s) => s.apis.includes(c.api)).map((s) => s.id)).toEqual([c.service]);
    expect((generated.datasets as Record<string, string[]>)[c.dataset]).toEqual([c.service]);
    expect(rankTools(c.tool.replaceAll("_", " "), service.tools)).toContain(c.tool);
    expect(createHash("sha256").update(readFileSync(new URL(`./fixtures/batch088/${c.file}.json`, import.meta.url))).digest("hex")).toBe(c.sha256);
  }
  for (const [file, hash] of Object.entries(hashes)) expect(createHash("sha256").update(readFileSync(new URL(`./fixtures/batch088/${file}`, import.meta.url))).digest("hex")).toBe(hash);
});
it.each(batch088)("preserves real source values, nulls, dates, languages and cached requests: $file", async (c) => {
  const source = fixture088(c);
  fetchMock.mockImplementation(async () => Response.json(source));
  for (const [lang, field] of Object.entries(c.names)) {
    const result = await call088(c.tool, { lang });
    expect(result.meta.source).toBe(request088(c));
    const expected = source.features.map((f: { attributes: Record<string, unknown>; geometry: unknown }) => ({ ...f.attributes, name: f.attributes[field!],
      ...(Buffer.byteLength(JSON.stringify(f.geometry)) > 20000 ? { geometryOmitted: expect.any(String) } : { geometry: f.geometry }) }));
    expect(result.data).toEqual({ language: lang, coordinateSystem: "WGS84 (longitude, latitude)", results: expected, returned: expected.length,
      hasMore: source.exceededTransferLimit === true, nextOffset: source.exceededTransferLimit === true ? expected.length : null });
  }
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it.each(batch088)("rejects malformed bounds and queries before fetch: $file", async (c) => {
  const inputs: Record<string, unknown>[] = [{ limit: 0 }, { limit: 101 }, { limit: 1.5 }, { offset: -1 }, { offset: 1000001 }, { objectId: 0 }, { objectId: 1.2 }, { objectId: 2147483648 }, { lang: "fr" }, { bbox: "abc" }, { bbox: "114,23,115,22" }, { bbox: "-181,20,114,21" }];
  if (c.search.length) inputs.push(...[{ search: "" }, { search: " " }, { search: "x".repeat(101) }, { searchField: "DROP TABLE" }]);
  for (const input of inputs) await expect(call088(c.tool, input)).rejects.toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
});
it.each(batch088)("uses stable paging, geometry and SQL-escaped allowlisted search: $file", async (c) => {
  fetchMock.mockResolvedValueOnce(Response.json({ features: [] }));
  await call088(c.tool, { ...(c.search.length ? { search: "O'Brien%_" } : {}), objectId: 7, bbox: "113,21,115,23", limit: 1, offset: 2, geometry: false });
  const q = new URL(String(fetchMock.mock.lastCall![0])).searchParams;
  expect(q.get("where")).toBe(`1=1 AND OBJECTID=7${c.search.length ? ` AND UPPER(${c.names.en}) LIKE '%O''BRIEN%_%'` : ""}`);
  expect(q.get("orderByFields")).toBe("OBJECTID ASC"); expect(q.get("resultRecordCount")).toBe("1"); expect(q.get("resultOffset")).toBe("2");
  expect(q.get("geometry")).toBe("113,21,115,23"); expect(q.get("inSR")).toBe("4326"); expect(q.get("returnGeometry")).toBe("false");
});
it.each(batch088)("handles empty, continuation and oversize geometry without losing data: $file", async (c) => {
  noCache(); fetchMock.mockResolvedValueOnce(Response.json({ features: [] }));
  expect((await call088(c.tool, { offset: 1000000 })).data).toMatchObject({ results: [], returned: 0, hasMore: false, nextOffset: null });
  const body = fixture088(c); body.features = body.features.slice(0,1); body.exceededTransferLimit = true;
  fetchMock.mockResolvedValueOnce(Response.json(body));
  expect((await call088(c.tool, { limit: 1, offset: 2 })).data).toMatchObject({ returned: 1, nextOffset: 3 });
  fetchMock.mockResolvedValueOnce(Response.json(body));
  expect((await call088(c.tool, { geometry: false })).data).toMatchObject({ results: [expect.not.objectContaining({ geometry: expect.anything() })] });
  expect(definition088(c.tool).service.cacheTtl).toBe(3600);
});
it.each(batch088)("propagates provider failures, malformed and empty-invalid responses without retries: $file", async (c) => {
  noCache(); fetchMock.mockResolvedValueOnce(new Response("Maintenance", { status: 503 }));
  await expect(call088(c.tool)).rejects.toMatchObject({ code: "upstream_http", status: 503 });
  fetchMock.mockRejectedValueOnce(new DOMException("timeout", "TimeoutError")); await expect(call088(c.tool)).rejects.toMatchObject({ code: "upstream_timeout" });
  fetchMock.mockRejectedValueOnce(new Error("offline")); await expect(call088(c.tool)).rejects.toMatchObject({ code: "upstream_network" });
  fetchMock.mockResolvedValueOnce(Response.json({ error: { code: 400, message: "Bad query" } })); await expect(call088(c.tool)).rejects.toMatchObject({ code: "upstream_http" });
  for (const body of [null, {}, { features: [null] }, { features: [{ attributes: {} }] }, { features: [], exceededTransferLimit: true }]) {
    fetchMock.mockResolvedValueOnce(Response.json(body)); await expect(call088(c.tool)).rejects.toMatchObject({ code: "upstream_parse" });
  }
  fetchMock.mockResolvedValueOnce(new Response("<html>maintenance</html>")); await expect(call088(c.tool)).rejects.toMatchObject({ code: "upstream_parse" });
  const broken = fixture088(c); delete broken.features[0].attributes[c.names.en];
  fetchMock.mockResolvedValueOnce(Response.json(broken)); await expect(call088(c.tool)).rejects.toMatchObject({ code: "upstream_parse" });
  expect(fetchMock).toHaveBeenCalledTimes(11);
});
it.each(batch088)("rejects wrong CRS and corrupted geometry: $file", async (c) => {
  noCache(); const body = fixture088(c); body.spatialReference = { wkid: 2326 };
  fetchMock.mockResolvedValueOnce(Response.json(body)); await expect(call088(c.tool)).rejects.toMatchObject({ code: "upstream_parse" });
  body.spatialReference = { wkid: 4326 }; body.features[0].geometry = { x: 999, y: 22, points: [[999,22]], paths: [[[999,22],[114,22]]], rings: [[[999,22],[114,22],[114,23],[999,22]]] };
  fetchMock.mockResolvedValueOnce(Response.json(body)); await expect(call088(c.tool)).rejects.toMatchObject({ code: "upstream_parse" });
});

it("enforces the 100 KB page boundary without silently losing the next record", async () => {
  noCache(); const c = batch088.find((e) => e.api === "API-3362")!;
  const body = fixture088(c); body.features[0].attributes[c.names.en] = "x".repeat(60000); body.features[1].attributes[c.names.en] = "x".repeat(60000);
  fetchMock.mockResolvedValueOnce(Response.json(body));
  // name duplicates the localized field, so a single 60 KB value already exceeds 100 KB.
  await expect(call088(c.tool, { geometry: false })).rejects.toMatchObject({ code: "upstream_parse" });
  body.features[0].attributes[c.names.en] = "x".repeat(30000); body.features[1].attributes[c.names.en] = "x".repeat(30000);
  fetchMock.mockResolvedValueOnce(Response.json(body));
  const data = (await call088(c.tool, { geometry: false })).data as { results: unknown[]; nextOffset: number; hasMore: boolean };
  expect(data.results).toHaveLength(1); expect(data.hasMore).toBe(true); expect(data.nextOffset).toBe(1);
  expect(Buffer.byteLength(JSON.stringify(data))).toBeLessThan(101000);
});
