/* eslint-disable @typescript-eslint/no-require-imports -- Local Postman fixture replay uses CommonJS. */
// Local-only mock of official CSDI captures from 2026-10-22.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const fixtureRoot = path.resolve(__dirname, "../../../tests/fixtures/environment022");
const manifest = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "manifest.json"), "utf8"));
http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const match = url.pathname.match(/^\/server\/rest\/services\/common\/([^/]+)\/FeatureServer\/(\d+)\/query$/);
  const entry = match && manifest.find((candidate) => candidate.layer === match[1]);
  const layer = entry && (entry.habitats || [{ id: 0, objectIdField: "OBJECTID" }]).find((candidate) => candidate.id === Number(match[2]));
  if (req.method !== "GET" || !entry || !layer) { res.writeHead(501); return res.end("Endpoint not modeled"); }
  const failure = req.headers["x-fixture-failure"];
  if (failure === "http") { res.writeHead(503, { "Content-Type": "text/html" }); return res.end("<html>Maintenance</html>"); }
  if (failure === "parse") { res.writeHead(200, { "Content-Type": "text/html" }); return res.end("<html>Invalid provider data</html>"); }
  if (failure === "provider" || failure === "feature") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(failure === "provider" ? { error: { code: 400, message: "Invalid query" } } : { features: [{}] }));
  }
  const offset = Number(url.searchParams.get("resultOffset"));
  const limit = Number(url.searchParams.get("resultRecordCount"));
  if (url.searchParams.get("orderByFields") !== `${layer.objectIdField} ASC` || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
    res.writeHead(400); return res.end("Invalid bounded query");
  }
  const body = JSON.parse(fs.readFileSync(path.join(fixtureRoot, `${entry.id}${layer.id ? `-${layer.id}` : ""}.json`), "utf8"));
  const count = body.features.length;
  body.features = body.features.slice(offset, offset + limit);
  body.exceededTransferLimit = offset + body.features.length < count;
  res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(body));
}).listen(process.env.PORT || 4922);
