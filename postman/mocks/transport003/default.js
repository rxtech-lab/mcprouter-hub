/* eslint-disable @typescript-eslint/no-require-imports -- Postman runs CommonJS handlers. */
// Samples captured from the official providers on 2026-10-20; read-only requests only.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const fixtures = path.resolve(__dirname, "../../../tests/fixtures/transport003");
const spatial = {
  cad_rcd_1697012233561_39672: "cad.json",
  cedd_rcd_1696844622988_9055: "cedd.json",
  epd_rcd_1631080339740_69941: "epd.json",
  hyd_rcd_1632210391486_52565: "hyd.json",
};
http.createServer((req, res) => {
  if (req.method !== "GET") { res.writeHead(501); return res.end("Not modeled"); }
  if (req.headers["x-transport003-failure"] === "http") {
    res.writeHead(503, { "Content-Type": "text/html" }); return res.end("<html>Provider maintenance</html>");
  }
  if (req.headers["x-transport003-failure"] === "malformed") {
    res.writeHead(200, { "Content-Type": "text/html" }); return res.end("<html>Invalid file</html>");
  }
  const url = new URL(req.url, "http://localhost");
  let file;
  const match = url.pathname.match(/^\/server\/rest\/services\/common\/([^/]+)\/FeatureServer\/0\/query$/);
  if (match) file = spatial[match[1]];
  if (url.pathname === "/v1.1/transport/batch/stop-route/CTB/001001") file = "bus-routes.json";
  if (url.pathname === "/v1/transport/batch/stop-eta/NLB/1") file = "bus-eta.json";
  if (url.pathname === "/hcms/filemanager/common/csv/statistics/passenger_land_en.csv") file = "customs.csv";
  if (url.pathname === "/doc/psi/ds/psi-t-cp_ENG.csv") file = "gpa-en.csv";
  if (!file) { res.writeHead(501); return res.end("Endpoint not modeled"); }
  res.writeHead(200, { "Content-Type": file.endsWith("csv") ? "text/csv; charset=utf-8" : "application/json" });
  res.end(fs.readFileSync(path.join(fixtures, file)));
}).listen(process.env.PORT || 4903);
