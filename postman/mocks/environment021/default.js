/* eslint-disable @typescript-eslint/no-require-imports -- Local Postman fixture replay uses CommonJS. */
// Official EPD/CSDI captures, 2026-10-22. This mock is local only (uses fs).
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const fixtureRoot = path.resolve(__dirname, "../../../tests/fixtures/environment021");
const layers = {
  epd_rcd_1630899452408_9505: "API-1834",
  epd_rcd_1666161129768_2527: "API-1839",
  epd_rcd_1666160952535_97414: "API-1840",
  epd_rcd_1664940858993_72368: "API-1841",
  epd_rcd_1629267205235_67879: "API-1842",
};
http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const spatial = url.pathname.match(/^\/server\/rest\/services\/common\/([^/]+)\/FeatureServer\/0\/query$/);
  const water = url.pathname.match(/^\/(marine|river)psi\/(en|tc|sc)\/\1recent\/\1-recent-\2.csv$/);
  const historical = url.pathname.match(/^\/riverpsi\/(en|tc|sc)\/riverhistorical\/river-historical-2025-\1.csv$/);
  const file = spatial && layers[spatial[1]] ? `${layers[spatial[1]]}.json` : water ? `${water[1]}-${water[2]}.csv` : historical ? `historical-${historical[1]}.csv` : null;
  if (req.method !== "GET" || !file) { res.writeHead(501); return res.end("Endpoint not modeled"); }
  const failure = req.headers["x-fixture-failure"];
  if (failure === "http") { res.writeHead(503, { "Content-Type": "text/html" }); return res.end("<html>Maintenance</html>"); }
  if (failure === "parse") { res.writeHead(200, { "Content-Type": "text/html" }); return res.end("<html>Invalid provider data</html>"); }
  if (failure === "provider" || failure === "feature") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(failure === "provider" ? { error: { code: 400, message: "Invalid query" } } : { features: [{}] }));
  }
  let data = fs.readFileSync(path.join(fixtureRoot, file), "utf8");
  if (spatial) {
    const body = JSON.parse(data);
    const offset = Number(url.searchParams.get("resultOffset"));
    const limit = Number(url.searchParams.get("resultRecordCount"));
    if (url.searchParams.get("orderByFields") !== "OBJECTID ASC" || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
      res.writeHead(400); return res.end("Invalid bounded query");
    }
    const count = body.features.length;
    body.features = body.features.slice(offset, offset + limit);
    body.exceededTransferLimit = offset + body.features.length < count;
    data = JSON.stringify(body);
  }
  res.writeHead(200, { "Content-Type": spatial ? "application/json" : "text/csv; charset=utf-8" });
  res.end(data);
}).listen(process.env.PORT || 4921);
