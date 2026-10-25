import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { cached } from "@/lib/mcp/cache";
import { UpstreamError } from "@/lib/mcp/fetcher";
import type { ToolHandler } from "@/lib/mcp/types";

export const readRinex: ToolHandler = async (input, { service, tool }) => {
  const year = Number(input.year), day = Number(input.day), hour = Number(input.hour);
  const leap = new Date(Date.UTC(year, 1, 29)).getUTCDate() === 29;
  if (day > (leap ? 366 : 365)) throw new Error("day exceeds the number of days in this UTC year.");
  const site = String(input.station).toLowerCase(), ddd = String(day).padStart(3, "0");
  const path = `/rinex2/${year}/${ddd}/${site}/${input.interval}s/${site}${ddd}${String.fromCharCode(97 + hour)}.${String(year).slice(-2)}d.gz`;
  const source = `${tool.spec.baseUrl ?? "https://rinex.geodetic.gov.hk"}${path}`;
  return cached(`rinex ${source}`, service.cacheTtl, async () => {
    const compressed = await boundedDownload(source, 2_000_000, tool.spec.timeoutMs ?? 15000, tool.spec.headers);
    try {
      const content = gunzipSync(compressed, { maxOutputLength: 16_000_000 });
      const text = content.toString("ascii"), end = text.indexOf("END OF HEADER");
      if (!text.startsWith("1.0") || end < 0 || end > 16000 || !text.includes("COMPACT RINEX FORMAT") || !text.includes("RINEX VERSION / TYPE")) throw new Error("Unexpected CompactRINEX header");
      const header = text.slice(0, end + 13).split(/\r?\n/);
      const marker = header.find((line) => line.includes("MARKER NAME"))?.slice(0, 60).trim();
      if (marker !== String(input.station)) throw new Error("Station does not match the requested RINEX file");
      return { source, station: marker, year, day, hourUTC: hour, intervalSeconds: Number(input.interval),
        format: "gzip / Hatanaka CompactRINEX 1.0 / RINEX 2 observation data", compressedBytes: compressed.length,
        uncompressedBytes: content.length, sha256: createHash("sha256").update(compressed).digest("hex"), header,
        note: "Validated gzip and structured header; observations remain Hatanaka encoded. Use RNXCMP to restore observations from the linked file. Times are UTC; missing files return the provider HTTP status." };
    } catch (error) { throw new UpstreamError("upstream_parse", `Invalid or oversized SatRef CompactRINEX file: ${(error as Error).message}`); }
  });
};

export async function boundedDownload(source: string, max: number, timeout: number, headers?: Record<string, string>) {
  try {
    const response = await fetch(source, { headers, signal: AbortSignal.timeout(timeout), cache: "no-store", redirect: "error" });
    if (!response.ok) throw new UpstreamError("upstream_http", `Download answered ${response.status}; this resource may not be available for the selected date or item.`, response.status);
    if (!response.body || Number(response.headers.get("content-length")) > max) throw new UpstreamError("upstream_parse", `Download is missing or exceeds ${max} bytes; use the official download link.`);
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) { const { value, done } = await reader.read(); if (done) break;
        size += value.byteLength; if (size > max) { await reader.cancel(); throw new UpstreamError("upstream_parse", `Download exceeds ${max} bytes; use the official download link.`); } chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    return Buffer.concat(chunks);
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    if (["AbortError", "TimeoutError"].includes((error as Error).name)) throw new UpstreamError("upstream_timeout", "Provider download timed out; check availability later.");
    throw new UpstreamError("upstream_network", `Could not reach download provider: ${(error as Error).message}`);
  }
}
