/* eslint-disable @typescript-eslint/no-require-imports -- Local Postman capture replay uses CommonJS. */
// Official provider captures, 2026-10-22. No cloud publication.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../../../tests/fixtures/environment023");
const entries = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const spatial = url.pathname.match(/\/common\/([^/]+)\/FeatureServer\/0\/query$/);
  const entry = spatial ? entries.find((e) => e.layer === spatial[1]) : entries.find((e) => e.url && new URL(e.url).pathname.replace(/(?:_uc|_sc)?\.csv$/, ".csv") === url.pathname.replace(/(?:_uc|_sc)?\.csv$/, ".csv"));
  if (req.method !== "GET" || !entry) { res.writeHead(501); return res.end("Endpoint not modeled"); }
  const failure = req.headers["x-fixture-failure"];
  if (failure === "http") { res.writeHead(503); return res.end("<html>Maintenance</html>"); }
  if (failure === "parse") return res.end("<html>Invalid provider data</html>");
  if (failure === "malformed") return res.end(entry.kind === "spatial" ? '{"features":[{}]}' : "{}");
  if (entry.kind === "spatial") {
    const offset = Number(url.searchParams.get("resultOffset"));
    const limit = Number(url.searchParams.get("resultRecordCount"));
    if (url.searchParams.get("orderByFields") !== "OBJECTID ASC" || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) { res.writeHead(400); return res.end("Invalid bounded query"); }
    const body = JSON.parse(fs.readFileSync(path.join(root, `${entry.id}.json`), "utf8"));
    const count = body.features.length; body.features = body.features.slice(offset, offset + limit); body.exceededTransferLimit = offset + body.features.length < count;
    return res.end(JSON.stringify(body));
  }
  const lang = entry.kind === "clothes" ? "en" : entry.kind === "daily" ? url.searchParams.get("lang") : /_uc\.csv$/.test(url.pathname) ? "tc" : /_sc\.csv$/.test(url.pathname) ? "sc" : "en";
  if (!["en", "tc", "sc"].includes(lang)) { res.writeHead(400); return res.end("Invalid language"); }
  return res.end(fs.readFileSync(path.join(root, `${entry.id}-${lang}.${entry.kind === "daily" ? "json" : "csv"}`)));
}).listen(process.env.PORT || 4923);
