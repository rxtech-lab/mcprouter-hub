import { createHash } from "node:crypto";
import { cached } from "@/lib/mcp/cache";
import { UpstreamError } from "@/lib/mcp/fetcher";
import type { ToolHandler } from "@/lib/mcp/types";

const documentation = "https://portal.csdi.gov.hk/csdi-webpage/apidoc/TopographicMapAPI";

/** PNG stays at its source; the tool provides verified, bounded tile metadata. */
export const tile: ToolHandler = async (input, { service, tool }) => {
  const source = `${tool.spec.baseUrl ?? service.baseUrl}/gs/api/v1.0.0/xyz/basemap/${input.sr}/${input.z}/${input.x}/${input.y}.png`;
  return cached(`landsd-png ${source}`, tool.spec.cacheTtl ?? service.cacheTtl, async () => {
    try {
      const response = await fetch(source, { headers: { Accept: "image/png", ...tool.spec.headers },
        signal: AbortSignal.timeout(tool.spec.timeoutMs ?? 15000), cache: "no-store", redirect: "error" });
      if (response.status === 204) return { source, available: false, reason: "No tile at these coordinates; choose coordinates in the published map extent.", documentation };
      if (!response.ok) throw new UpstreamError("upstream_http", `LandsD tile answered ${response.status}; check the tile coordinates or provider status.`, response.status);
      const bad = () => new UpstreamError("upstream_parse", "LandsD did not return a supported PNG tile (maximum 1 MB, 4096 pixels per dimension); check the source URL.");
      if (response.headers.get("content-type")?.split(";")[0] !== "image/png" || !response.body || Number(response.headers.get("content-length")) > 1048576) throw bad();
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 1048576) { await reader.cancel(); throw bad(); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const png = Buffer.concat(chunks);
      if (png.length < 45 || !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || png.readUInt32BE(8) !== 13 || png.toString("ascii", 12, 16) !== "IHDR" || png.toString("ascii", png.length - 8, png.length - 4) !== "IEND") throw bad();
      const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
      if (width < 1 || height < 1 || width > 4096 || height > 4096) throw bad();
      return { source, available: true, format: "PNG", width, height, bytes: size,
        sha256: createHash("sha256").update(png).digest("hex"), spatialReference: input.sr,
        zoom: input.z, x: input.x, y: input.y, documentation,
        attribution: "Map from Lands Department. Display the Lands Department logo on the map face and the copyright notice required in the provider terms.",
        terms: "https://portal.csdi.gov.hk/csdi-webpage/doc/TNC" };
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      const name = (error as Error).name;
      if (name === "TimeoutError" || name === "AbortError") throw new UpstreamError("upstream_timeout", "LandsD tile request timed out; try later.");
      throw new UpstreamError("upstream_network", `Could not reach LandsD tile service: ${(error as Error).message}`);
    }
  });
};
