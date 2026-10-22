import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { definition023, fileCases023 } from "./environment023-cases";
const fetchMock = vi.fn<typeof fetch>();
function call(name: string, input: Record<string, unknown> = {}) {
  const { service, tool } = definition023(name);
  return executeTool(service, tool, input);
}
beforeEach(() => {
  const store = new Map<string, unknown>();
  setCacheForTesting({ get: async (key) => store.get(key) ?? null, set: async (key, value) => void store.set(key, value), delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); setCacheForTesting(null); });

describe.each(fileCases023)("$tool $lang captured provider contract", (c) => {
  it("selects the published language URL, parses records, and reuses cached download", async () => {
    fetchMock.mockResolvedValue(new Response(c.reply));
    const result = await call(c.tool, c.input);
    const data = result.data as { results: Record<string, unknown>[]; returned: number; hasMore: boolean; nextOffset: number };
    expect(data.returned).toBe(2); expect(data.hasMore).toBe(true); expect(data.nextOffset).toBe(2);
    expect(fetchMock.mock.calls[0][0]).toBe(c.request.url);
    expect((await call(c.tool, c.input)).data).toEqual(data);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const first = data.results[0];
    if (c.kind === "hourly") {
      expect(first).toEqual({ time: "2026102214", station: c.lang === "en" ? "Ping Chau" : "平洲", microsievertsPerHour: 0.09, sourceValue: "0.09" });
      expect(data).toMatchObject({ provisional: true, timeZone: "Asia/Hong_Kong" });
    } else if (c.kind === "clothes") {
      expect(first).toMatchObject({ district: c.lang === "en" ? "Central & Western" : c.lang === "tc" ? "中西區" : "中西区", telephone: "2528 5588", fax: "2529 2777", schemeManager: c.lang === "en" ? "Friends of the Earth (Hong Kong)" : "香港地球之友" });
      expect(first.address).toContain(c.lang === "en" ? "48-50 Aberdeen Street" : "41");
      expect(first.managerAddress).toContain(c.lang === "en" ? "1301-1302" : "1301");
    } else {
      expect(first).toMatchObject({ station: c.lang === "en" ? "Chek Lap Kok" : "赤鱲角", fields: { ChekLapKokMicrosieverts: "0.15", ChekLapKokMaxTemp: "33.6", ChekLapKokMinTemp: "26.8" } });
      expect(data).toMatchObject({ requestedDate: "20261021", reportDate: "20261021", bulletinDate: "20261022", provisional: true, observatoryReadings: { HKOReadingsMaxTemp: "32.5", HKOReadingsRainfall: "0" } });
    }
  });
  it("filters and paginates without losing or duplicating records, then returns a truthful empty page", async () => {
    fetchMock.mockResolvedValue(new Response(c.reply));
    const data = (await call(c.tool, c.input)).data as { results: Record<string, unknown>[] };
    expect((await call(c.tool, { ...c.input, offset: 1, limit: 1 })).data).toMatchObject({ results: [data.results[1]] });
    expect((await call(c.tool, { ...c.input, offset: 1000000 })).data).toMatchObject({ results: [], returned: 0, hasMore: false, nextOffset: null });
    expect((await call(c.tool, { ...c.input, search: "zzzz-no-such-record-zzzz" })).data).toMatchObject({ results: [], nextOffset: null });
    const term = String(data.results[0][c.kind === "clothes" ? "telephone" : "station"]);
    expect((await call(c.tool, { ...c.input, search: term })).data).toMatchObject({ results: expect.arrayContaining([data.results[0]]) });
  });
  it.each([["maintenance", 503, "upstream_http"], ["<html>maintenance</html>", 200, "upstream_parse"], ["{}", 200, "upstream_parse"]])("rejects invalid upstream body %s", async (body, status, code) => {
    fetchMock.mockResolvedValueOnce(new Response(String(body), { status: Number(status) }));
    await expect(call(c.tool, c.input)).rejects.toMatchObject({ code });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed inputs before HTTP", async () => {
    for (const bad of [{ limit: 0 }, { limit: 101 }, { offset: -1 }, { lang: "fr" }, { search: "x".repeat(101) },
      ...(c.kind === "daily" ? [{ date: "20260230" }, { date: "20261301" }, { date: "today" }] : [])]) {
      await expect(call(c.tool, { ...c.input, ...bad })).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
it("keeps missing hourly readings distinct from zero and rejects invalid numbers", async () => {
  const c = fileCases023.find((c) => c.kind === "hourly")!;
  fetchMock.mockResolvedValueOnce(new Response(c.reply.replace(",0.09", ",M")));
  expect((await call(c.tool, c.input)).data).toMatchObject({ results: [{ microsievertsPerHour: null, sourceValue: "M" }, expect.anything()] });
  setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockResolvedValueOnce(new Response(c.reply.replace(",0.09", ",-2")));
  await expect(call(c.tool, c.input)).rejects.toMatchObject({ code: "upstream_parse" });
});
it("rejects truncated CSV rows instead of returning partial records", async () => {
  for (const c of fileCases023.filter((c) => c.kind !== "daily" && c.lang === "en")) {
    fetchMock.mockResolvedValueOnce(new Response(c.reply.split("\n")[0] + "\nonly-one-cell\n"));
    await expect(call(c.tool, c.input)).rejects.toMatchObject({ code: "upstream_parse" });
  }
});
