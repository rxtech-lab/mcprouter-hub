import { UpstreamError } from "@/lib/mcp/fetcher";
const bad = () => { throw new UpstreamError("upstream_parse", "SatRef returned malformed or corrupt raw data; check the official service status."); };

/** NMEA checksums cover the ASCII between $ and *. Preserve units and source sentence. */
export function nmeaSamples(data: Buffer) {
  const lines = data.toString("ascii").split("\n").slice(0, -1);
  return lines.filter((line) => line.startsWith("$GPGGA,") || line.startsWith("$GNGGA,")).map((line) => {
    const raw = line.trim();
    if (!/^\$[A-Z]{2}GGA,[\x20-\x7e]+\*[0-9A-F]{2}$/.test(raw)) return bad();
    const end = raw.lastIndexOf("*"); let checksum = 0;
    for (const char of raw.slice(1, end)) checksum ^= char.charCodeAt(0);
    if (checksum !== parseInt(raw.slice(end + 1), 16)) return bad();
    const f = raw.slice(1, end).split(",");
    if (f.length !== 15 || !/^\d{6}(\.\d+)?$/.test(f[1]) || !/^[0-8]$/.test(f[6])) return bad();
    const coordinate = (value: string, hemisphere: string, latitude: boolean) => {
      if (!value && !hemisphere && f[6] === "0") return null;
      if (!/^\d+(\.\d+)?$/.test(value) || !(latitude ? /^[NS]$/ : /^[EW]$/).test(hemisphere)) return bad();
      const degrees = Math.floor(Number(value) / 100), minutes = Number(value) % 100;
      if (minutes >= 60 || degrees + minutes / 60 > (latitude ? 90 : 180)) return bad();
      return (degrees + minutes / 60) * (/[SW]/.test(hemisphere) ? -1 : 1);
    };
    const number = (value: string) => value === "" ? null : /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : bad();
    return { sentence: raw, utc: f[1], latitude: coordinate(f[2], f[3], true), longitude: coordinate(f[4], f[5], false),
      quality: Number(f[6]), satellites: number(f[7]), hdop: number(f[8]), altitude: number(f[9]), altitudeUnit: f[10],
      geoidSeparation: number(f[11]), geoidUnit: f[12], differentialAgeSeconds: number(f[13]), referenceStation: f[14] };
  });
}

/** Decode complete HTTP chunks available so far; ICY streams have no transfer encoding. */
export function unchunk(data: Buffer) {
  const chunks: Buffer[] = []; let offset = 0;
  while (offset < data.length) {
    const eol = data.indexOf("\r\n", offset); if (eol < 0) break;
    const sizeText = data.toString("ascii", offset, eol).split(";")[0];
    if (!/^[0-9a-f]+$/i.test(sizeText)) return bad();
    const size = parseInt(sizeText, 16); if (size === 0) break;
    if (eol + 2 + size + 2 > data.length) break;
    if (data.toString("ascii", eol + 2 + size, eol + 4 + size) !== "\r\n") return bad();
    chunks.push(data.subarray(eol + 2, eol + 2 + size)); offset = eol + 4 + size;
  }
  return Buffer.concat(chunks);
}
