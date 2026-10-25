import { createConnection } from "node:net";
import { cached } from "@/lib/mcp/cache";
import { UpstreamError } from "@/lib/mcp/fetcher";
import type { ToolHandler } from "@/lib/mcp/types";
import { nmeaSamples, unchunk } from "./protocol";

function stream(): ToolHandler {
  return async (input, { service, tool }) => {
    const mount = `${input.station}_NMEA`;
    const base = new URL(tool.spec.baseUrl ?? service.baseUrl!);
    const source = `${base.toString().replace(/\/$/, "")}/${mount}`;
    const limit = Number(input.limit);
    return cached(`satref ${source} ${limit}`, tool.spec.cacheTtl ?? service.cacheTtl, () => new Promise((resolve, reject) => {
      const socket = createConnection({ host: base.hostname, port: Number(base.port || 80) });
      let bytes = Buffer.alloc(0), settled = false;
      const finish = (error?: Error, data?: unknown) => {
        if (settled) return; settled = true; clearTimeout(timer); socket.destroy();
        if (error) reject(error); else resolve(data);
      };
      const timer = setTimeout(() => finish(new UpstreamError("upstream_timeout", "SatRef did not provide the requested complete sample within 35 seconds; choose fewer samples or check caster availability.")), tool.spec.timeoutMs ?? 35000);
      socket.on("connect", () => socket.write(`GET ${base.pathname.replace(/\/$/, "")}/${mount} HTTP/1.0\r\nHost: ${base.host}\r\nUser-Agent: NTRIP mcprouter/1.0\r\nAccept: */*\r\nConnection: close\r\n${Object.entries(tool.spec.headers ?? {}).map(([k, v]) => `${k}: ${v}\r\n`).join("")}\r\n`));
      socket.on("data", (chunk) => {
        try {
          bytes = Buffer.concat([bytes, typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk]);
          if (bytes.length > 65536) throw new UpstreamError("upstream_parse", "SatRef sample exceeds 64 KB; request fewer frames.");
          const end = bytes.indexOf("\r\n\r\n");
          if (end < 0) { if (bytes.length > 8192) throw new UpstreamError("upstream_parse", "Malformed NTRIP response headers."); return; }
          const header = bytes.toString("ascii", 0, end), status = /^(?:ICY|HTTP\/1\.[01]) (\d{3})\b/.exec(header);
          if (!status) throw new UpstreamError("upstream_parse", "Expected an NTRIP ICY or HTTP response.");
          if (status[1] !== "200") throw new UpstreamError("upstream_http", `SatRef caster answered ${status[1]}; check the selected mountpoint.`, Number(status[1]));
          const raw = bytes.subarray(end + 4);
          const body = /transfer-encoding:\s*chunked/i.test(header) ? unchunk(raw) : raw;
          const rows = nmeaSamples(body);
          if (rows.length >= limit) { finish(undefined, { source, format: "NMEA-0183 GGA", station: input.station,
            sampledAt: new Date().toISOString(), sampleWindowSeconds: 35, results: rows.slice(0, limit), returned: limit,
            note: "Bounded live snapshot, not a continuous subscription. Source checksums are validated." }); }
        } catch (error) { finish(error as Error); }
      });
      socket.on("error", (error) => finish(new UpstreamError("upstream_network", `Could not reach SatRef public NTRIP caster: ${error.message}`)));
      socket.on("end", () => finish(new UpstreamError("upstream_parse", "SatRef closed the stream before enough complete valid samples arrived.")));
    }));
  };
}
export const nmea = stream();

import { readRinex } from "./rinex";
export const rinex = readRinex;
