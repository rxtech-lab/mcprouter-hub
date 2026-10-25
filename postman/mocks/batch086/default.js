// Official CSDI captures, no provider availability claim.
/* eslint-disable @typescript-eslint/no-require-imports -- Postman loads CommonJS handlers. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
/* eslint-enable @typescript-eslint/no-require-imports */
const folder = path.resolve(__dirname, "../../../tests/fixtures/batch086");
const manifest = JSON.parse(fs.readFileSync(path.join(folder, "manifest.json"), "utf8"));
http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const failure = req.headers["x-fixture-failure"];
  if (failure === "http") { res.writeHead(503).end("Maintenance"); return; }
  if (failure === "json") { res.end("<html>Maintenance</html>"); return; }
  if (failure === "timeout") { setTimeout(() => res.end("{}"), 250); return; }
  const send = (file, type) => { const bytes = fs.readFileSync(path.join(folder, file)); res.setHeader("Content-Type", type); res.setHeader("Content-Length", bytes.length); res.end(bytes); };
  if (url.pathname.startsWith("/rinex2/")) { send("rinex.gz", "application/gzip"); return; }
  if (/^\/HKFN_NMEA$/.test(url.pathname)) {
    const bytes = fs.readFileSync(path.join(folder, "nmea.bin")).subarray(14);
    res.setHeader("Content-Length", bytes.length); res.end(bytes); return;
  }
  const entry = manifest.find((c) => url.pathname.startsWith(`/server/rest/services/common/${c.layer}/FeatureServer/`));
  const layer = Number(url.pathname.match(/FeatureServer\/(\d+)\/query$/)?.[1]);
  if (req.method !== "GET" || !entry || !Number.isInteger(layer) || layer !== 0) { res.writeHead(501).end("Endpoint not in the captured contract"); return; }
  if (failure === "http") { res.writeHead(503).end("<html>Maintenance</html>"); return; }
  if (failure === "json") { res.end("<html>Maintenance</html>"); return; }
  if (failure === "timeout") { setTimeout(() => res.end("{}"), 250); return; }
  const body = JSON.parse(fs.readFileSync(path.join(folder, `${entry.file}.json`), "utf8"));
  const offset = Number(url.searchParams.get("resultOffset") || 0);
  const limit = Number(url.searchParams.get("resultRecordCount") || 20);
  body.exceededTransferLimit = offset + limit < body.features.length;
  body.features = body.features.slice(offset, offset + limit);
  if (url.searchParams.get("returnGeometry") === "false") body.features.forEach((f) => delete f.geometry);
  if (failure === "empty") { body.features = []; body.exceededTransferLimit = false; }
  if (failure === "malformed") delete body.features[0]?.attributes;
  if (failure === "arcgis") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: { code: 400, message: "Invalid query" } })); return; }
  res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body));
}).listen(process.env.PORT || 4985);
