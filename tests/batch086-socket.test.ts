import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import { setCacheForTesting } from "@/lib/mcp/cache";

const { connectMock } = vi.hoisted(() => ({ connectMock: vi.fn() }));
vi.mock("node:net", async (importOriginal) => ({ ...await importOriginal<typeof import("node:net")>(), createConnection: connectMock }));

const capture = readFileSync(new URL("./fixtures/batch086/nmea.bin", import.meta.url));
const service = services.find((s) => s.id === "landsd-satref")!;
const tool = service.tools.find((t) => t.name === "landsd_satref_nmea_snapshot")!;
let chunks: (Buffer | string)[];
let socket: EventEmitter & { write: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>; setEncoding: ReturnType<typeof vi.fn> };
beforeEach(() => {
  setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
  socket = Object.assign(new EventEmitter(), { write: vi.fn(), destroy: vi.fn(), setEncoding: vi.fn() });
  connectMock.mockReset().mockImplementation(() => {
    queueMicrotask(() => { socket.emit("connect"); for (const chunk of chunks) socket.emit("data", chunk); });
    return socket;
  });
});
afterEach(() => { setCacheForTesting(null); });

it.each(["buffer", "mixed", "string"])("preserves captured GGA bytes and coordinates across fragmented %s socket chunks", async (mode) => {
  const pieces = [capture.subarray(0, 13), capture.subarray(13, 42), capture.subarray(42)];
  chunks = pieces.map((piece, i) => mode === "string" || (mode === "mixed" && i === 1) ? piece.toString("utf8") : piece);
  const result = await executeTool(service, tool, {});
  expect(result.data).toMatchObject({ station: "HKFN", returned: 1, results: [{
    sentence: "$GPGGA,200322.00,2229.68117289,N,11408.29010166,E,4,25,0.6,44.675,M,-1.568,M,1.0,4095*6B",
    utc: "200322.00", quality: 4, satellites: 25, altitude: 44.675, geoidSeparation: -1.568,
  }] });
  expect(connectMock).toHaveBeenCalledWith({ host: "ntrip.geodetic.gov.hk", port: 2101 });
  expect(socket.write).toHaveBeenCalledWith(expect.stringContaining("GET /HKFN_NMEA HTTP/1.0\r\n"));
  expect(socket.setEncoding).not.toHaveBeenCalled();
  expect(socket.destroy).toHaveBeenCalledTimes(1);
});
it("keeps checksum rejection when a string fragment corrupts the source sentence", async () => {
  const corrupted = Buffer.from(capture); corrupted[30] ^= 1;
  chunks = [corrupted.subarray(0, 42).toString("utf8"), corrupted.subarray(42)];
  await expect(executeTool(service, tool, {})).rejects.toMatchObject({ code: "upstream_parse" });
  expect(socket.destroy).toHaveBeenCalledTimes(1);
});
