import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { nmeaSamples, unchunk } from "@/mcp/services/landsd-satref/protocol";
import provenance from "./fixtures/batch086/binary-provenance.json";

export const binary086 = (file: string) => readFileSync(new URL(`./fixtures/batch086/${file}`, import.meta.url));
const fetchMock = vi.fn<typeof fetch>();
const call = (name: string, input: Record<string, unknown>) => {
  const service = services.find((s) => s.tools.some((t) => t.name === name))!;
  return executeTool(service, service.tools.find((t) => t.name === name)!, input);
};
beforeEach(() => {
  const cache = new Map();
  setCacheForTesting({ get: async (k) => cache.get(k) ?? null, set: async (k, v) => void cache.set(k, v), delete: async () => {}, expireTag: async () => {} });
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); setCacheForTesting(null); });

it("preserves capture hashes and validates actual NMEA checksum / source coordinates", () => {
  for (const [file, hash] of Object.entries(provenance.captures)) expect(createHash("sha256").update(binary086(file)).digest("hex")).toBe(hash);
  const body = binary086("nmea.bin").subarray(14);
  const rows = nmeaSamples(body);
  expect(rows.length).toBeGreaterThan(0);
  expect(rows[0]).toMatchObject({ quality: 4, altitudeUnit: "M", geoidUnit: "M", referenceStation: "4095" });
  expect(rows[0].latitude).toBeCloseTo(22 + 29.68117289 / 60, 9);
  expect(rows[0].longitude).toBeCloseTo(114 + 8.29010166 / 60, 9);
  expect(nmeaSamples(body.subarray(0, 30))).toEqual([]);
  const corrupt = Buffer.from(body); corrupt[10] ^= 1;
  expect(() => nmeaSamples(corrupt)).toThrow(/corrupt/);
});
it("decodes complete HTTP chunks without accepting corrupt chunk framing", () => {
  expect(unchunk(Buffer.from("3\r\nabc\r\n2\r\nde\r\n0\r\n\r\n"))).toEqual(Buffer.from("abcde"));
  expect(() => unchunk(Buffer.from("x\r\n"))).toThrow();
});
it("reads a real gzip CompactRINEX file with bounds, complete header and station validation", async () => {
  fetchMock.mockResolvedValueOnce(new Response(binary086("rinex.gz")));
  const input = { year: 2026, day: 298 };
  const result = (await call("landsd_satref_rinex_header", input)).data as { header: string[]; station: string; uncompressedBytes: number };
  expect(result.station).toBe("HKCL"); expect(result.uncompressedBytes).toBe(632046);
  expect(result.header.at(-1)).toContain("END OF HEADER");
  expect(result.header.find((l) => l.includes("INTERVAL"))).toContain("5.000");
  await call("landsd_satref_rinex_header", input); expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("rejects unavailable, malformed, oversized and mismatched downloads; invalid inputs never fetch", async () => {
  const input = { year: 2026, day: 298 };
  for (const bad of [{ year: 2026, day: 366 }, { ...input, station: "../bad" }, { ...input, interval: 30 }, { ...input, hour: 24 }]) await expect(call("landsd_satref_rinex_header", bad)).rejects.toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
  fetchMock.mockResolvedValueOnce(new Response("missing", { status: 404 }));
  await expect(call("landsd_satref_rinex_header", input)).rejects.toMatchObject({ code: "upstream_http", status: 404 });
  fetchMock.mockResolvedValueOnce(new Response("not gzip"));
  await expect(call("landsd_satref_rinex_header", input)).rejects.toMatchObject({ code: "upstream_parse" });
  fetchMock.mockResolvedValueOnce(new Response(binary086("rinex.gz")));
  await expect(call("landsd_satref_rinex_header", { ...input, station: "HKLM" })).rejects.toMatchObject({ code: "upstream_parse" });
  fetchMock.mockResolvedValueOnce(new Response("oversized", { headers: { "content-length": "2000001" } }));
  await expect(call("landsd_satref_rinex_header", input)).rejects.toMatchObject({ code: "upstream_parse" });
  fetchMock.mockRejectedValueOnce(new DOMException("late", "TimeoutError"));
  await expect(call("landsd_satref_rinex_header", input)).rejects.toMatchObject({ code: "upstream_timeout" });
});
it("registers exactly the retained eight stable IDs; excluded APIs stay unregistered", () => {
  const own = services.filter((s) => ["landsd-development", "landsd-satref"].includes(s.id));
  expect(own.flatMap((s) => s.apis).sort()).toEqual(["API-3103", "API-3105", "API-3106", "API-3107", "API-3116", "API-3117", "API-3119", "API-3120"]);
  expect(services.some((s) => s.apis.includes("API-3101") || s.apis.includes("API-3118"))).toBe(false);
});
