/* eslint-disable @typescript-eslint/no-require-imports -- Postman local mocks run CommonJS. */
// Exact provider captures from 2026-10-22. Owner mock search skipped: CLI unauthenticated.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../../../tests/fixtures/environment024");
const entries = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const spatial = url.pathname.match(/\/common\/([^/]+)\/FeatureServer\/0\/query$/);
  const entry = spatial ? entries.find((e) => e.layer === spatial[1]) : url.pathname === "/api/get.php" ? entries.find((e) => e.table === url.searchParams.get("id")) : /^\/opendata\/v1\/environment\/?$/.test(url.pathname) ? entries.find((e) => e.kind === "towngas") : null;
  const windFile = url.pathname === "/pland_en/resources/site_wind/site_wind/table/annual/g_00337_lev500.txt";
  if (req.method !== "GET" || (!entry && !windFile)) { res.writeHead(501); return res.end("Endpoint not modeled"); }
  const failure = req.headers["x-fixture-failure"];
  if (failure === "http") { res.writeHead(503); return res.end("<html>Maintenance</html>"); }
  if (failure === "parse") return res.end("<html>Invalid data</html>");
  if (failure === "malformed") return res.end("{}");
  if (windFile) return res.end(read("wind-profile.txt"));
  if (entry.kind === "spatial") {
    const offset = Number(url.searchParams.get("resultOffset")); const limit = Number(url.searchParams.get("resultRecordCount"));
    if (url.searchParams.get("orderByFields") !== "OBJECTID ASC" || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) { res.writeHead(400); return res.end("Invalid bounded query"); }
    const body = JSON.parse(read(`${entry.id}.json`));
    const count = body.features.length; body.features = body.features.slice(offset, offset + limit); body.exceededTransferLimit = offset + body.features.length < count;
    return res.end(JSON.stringify(body));
  }
  const lang = url.searchParams.get("lang") || "en";
  if (!["en", "tc", "sc"].includes(lang)) { res.writeHead(400); return res.end("Invalid language"); }
  return res.end(read(entry.kind === "census" ? `${entry.table}-${lang}.json` : "towngas.json"));
}).listen(process.env.PORT || 4924);
