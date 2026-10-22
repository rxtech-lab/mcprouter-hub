import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { rankTools } from "@/lib/agent/tool-search";
import { spatialCases023, definition023, entries023 } from "./environment023-cases";

const fetchMock = vi.fn<typeof fetch>();
function call(name: string, input: Record<string, unknown> = {}) {
  const { service, tool } = definition023(name);
  return executeTool(service, tool, input);
}
beforeEach(() => {
  const cache = new Map<string, unknown>();
  setCacheForTesting({ get: async (key) => cache.get(key) ?? null, set: async (key, value) => void cache.set(key, value), delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); setCacheForTesting(null); });

describe("Environment batch 023 verified subset", () => {
  it.each(entries023)("registers $id and its permanent dataset exactly once", (entry) => {
    const owners = services.filter((s) => s.apis.includes(entry.id));
    expect(owners).toHaveLength(1);
    expect(owners[0].datasets).toContain(entry.dataset);
    expect(owners[0].tools.map((t) => t.name)).toContain(entry.tool);
  });
  it.each(spatialCases023)("preserves captured attributes, localized names and bounded paging for $file", async (c) => {
    fetchMock.mockResolvedValue(Response.json(c.reply));
    const first = await call(c.tool, c.input);
    expect(first.data).toEqual(c.data);
    expect((await call(c.tool, c.input)).data).toEqual(c.data);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(c.request.url);
  });
  describe.each(spatialCases023)("$file query contract", (c) => {
    it.each([
      ["HTTP maintenance", "maintenance", 503, "upstream_http"],
      ["HTML instead of JSON", "<html>maintenance</html>", 200, "upstream_parse"],
      ["provider error envelope", JSON.stringify({ error: { code: 400, message: "Invalid query" } }), 200, "upstream_http"],
      ["missing features", "{}", 200, "upstream_parse"],
      ["malformed attributes", JSON.stringify({ features: [{ attributes: [] }] }), 200, "upstream_parse"],
      ["malformed geometry", JSON.stringify({ features: [{ attributes: { OBJECTID: 1 }, geometry: [] }] }), 200, "upstream_parse"],
    ])("rejects %s", async (_label, body, status, code) => {
      fetchMock.mockResolvedValueOnce(new Response(String(body), { status: Number(status) }));
      await expect(call(c.tool, { ...c.input, geometry: true })).rejects.toMatchObject({ code });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    it("returns empty pages without phantom cursors", async () => {
      fetchMock.mockResolvedValueOnce(Response.json({ features: [] }));
      expect((await call(c.tool, { ...c.input, offset: 100 })).data).toMatchObject({ results: [], returned: 0, hasMore: false, nextOffset: null });
      expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("resultOffset")).toBe("100");
    });
    it("rejects malformed filters before any HTTP", async () => {
      for (const bad of [{ limit: 0 }, { limit: 101 }, { offset: -1 }, { objectId: 1.5 }, { lang: "fr" },
        { bbox: "bad" }, { bbox: "114,23,115,22" }, { bbox: "180,22,181,23" }, { search: "x".repeat(101) }, { searchField: "OBJECTID);DROP TABLE" },
        ...([])]) {
        await expect(call(c.tool, { ...c.input, ...bad })).rejects.toThrow();
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });
    it("uses the layer's unique ID and maps allowlisted search fields without OR", async () => {
      const fields = c.fields;
      for (const searchField of fields) {
        fetchMock.mockResolvedValueOnce(Response.json(c.reply));
        await call(c.tool, { ...c.input, objectId: 1, search: "O'Brien", searchField, bbox: "114,22,115,23", offset: 2, geometry: true });
        const params = new URL(String(fetchMock.mock.calls.at(-1)![0])).searchParams;
        const sourceField = searchField;
        expect(params.get("where")).toBe(`1=1 AND ${c.sublayer.objectIdField}=1 AND (UPPER(${sourceField}) LIKE '%O''BRIEN%')`);
        expect(Object.fromEntries(params)).toMatchObject({ orderByFields: `${c.sublayer.objectIdField} ASC`, geometry: "114,22,115,23", inSR: "4326", resultOffset: "2", returnGeometry: "true" });
      }
    });
    it("projects only published name languages and preserves source values", async () => {
      fetchMock.mockResolvedValue(Response.json(c.reply));
      for (const [lang, field] of Object.entries(c.names)) {
        const nameField = field;
        expect((await call(c.tool, { ...c.input, lang })).data).toMatchObject({ results: [expect.objectContaining({ name: c.reply.features[0].attributes[nameField] }), ...c.reply.features.slice(1).map(() => expect.anything())] });
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
  it.each(entries023)("finds $tool through discovery", (c) => {
    expect(rankTools(c.title, services.flatMap((s) => s.tools.map((t) => ({ name: t.name, description: t.description })))).slice(0, 8)).toContain(c.tool);
  });
  it.each(spatialCases023)("$tool omits excessive geometry explicitly and keeps attribute pagination usable", async (c) => {
    fetchMock.mockResolvedValueOnce(Response.json({ features: [{ attributes: { OBJECTID: 1, [c.names.en!]: "Collector" }, geometry: { paths: [["x".repeat(20001)]] } }] }));
    expect((await call(c.tool, { geometry: true })).data).toMatchObject({ results: [{ OBJECTID: 1, [c.names.en!]: "Collector", name: "Collector", geometryOmitted: expect.any(String) }] });
  });
  it.each(spatialCases023)("$tool bounds serialized data and returns the next unconsumed offset", async (c) => {
    fetchMock.mockResolvedValueOnce(Response.json({ features: Array.from({ length: 100 }, (_, i) => ({ attributes: { OBJECTID: i + 1, [c.names.en!]: "x".repeat(2000) } })) }));
    const { data } = await call(c.tool, { limit: 100, offset: 10 });
    const page = data as { returned: number; nextOffset: number };
    expect(Buffer.byteLength(JSON.stringify(data))).toBeLessThan(101000);
    expect(page.returned).toBeGreaterThan(0); expect(page.returned).toBeLessThan(100);
    expect(page.nextOffset).toBe(10 + page.returned);
  });
});
