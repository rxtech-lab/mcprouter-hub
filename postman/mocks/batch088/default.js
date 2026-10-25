// Replays actual official captures; no provider availability or SQL-engine claim.
/* eslint-disable @typescript-eslint/no-require-imports -- Postman loads CommonJS handlers. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
/* eslint-enable @typescript-eslint/no-require-imports */
const folder = path.resolve(__dirname, "../../../tests/fixtures/batch088");
const manifest = JSON.parse(fs.readFileSync(path.join(folder, "manifest.json"), "utf8"));
const years = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../mcp/services/pland-development/raster-years.json"), "utf8"));
http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const entry = manifest.find((c) => c.path === url.pathname);
  const year = Object.keys(years).find((y) => url.pathname === `/server/rest/services/common/${years[y]}/MapServer/identify`);
  if (req.method !== "GET" || (!entry && !year)) { res.writeHead(501).end("Endpoint not in the captured contract"); return; }
  const failure = req.headers["x-fixture-failure"];
  if (failure === "http") { res.writeHead(503).end("<html>Maintenance</html>"); return; }
  if (failure === "json") { res.end("<html>Maintenance</html>"); return; }
  if (failure === "timeout") { setTimeout(() => res.end("{}"), 250); return; }
  const body = JSON.parse(fs.readFileSync(path.join(folder, entry ? `${entry.file}.json` : `raster-${year}.json`), "utf8"));
  if (entry) {
    const offset = Number(url.searchParams.get("resultOffset") || 0);
    const limit = Number(url.searchParams.get("resultRecordCount") || 20);
    body.exceededTransferLimit = offset + limit < body.features.length;
    body.features = body.features.slice(offset, offset + limit);
    if (url.searchParams.get("returnGeometry") === "false") body.features.forEach((f) => delete f.geometry);
    if (failure === "empty") { body.features = []; body.exceededTransferLimit = false; }
    if (failure === "malformed") delete body.features[0]?.attributes;
  } else {
    if (failure === "empty") body.results = [];
    if (failure === "malformed") delete body.results[0]?.attributes;
  }
  res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body));
}).listen(process.env.PORT || 4988);
