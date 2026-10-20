// Local-only replay of compact official C&SD responses captured on 2026-10-21.
/* eslint-disable @typescript-eslint/no-require-imports -- Postman loads mock handlers as CommonJS. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
/* eslint-enable @typescript-eslint/no-require-imports */
const tables = new Set(["310-31013", "310-31014", "310-31015", "310-32021", "310-32022", "310-32023", "310-32024", "310-32031", "310-32032", "310-33041"]);
http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const id = url.searchParams.get("id");
  const lang = url.searchParams.get("lang");
  if (req.method !== "GET" || url.pathname !== "/api/get.php" || !tables.has(id) || !["en", "tc", "sc"].includes(lang) || url.searchParams.get("full_series") !== "1") {
    res.writeHead(501).end("Endpoint not defined by the GDP fixture contract");
    return;
  }
  const failure = req.headers["x-fixture-failure"];
  if (failure === "http") { res.writeHead(503).end("Maintenance"); return; }
  if (failure === "json") { res.writeHead(200).end("<html>Maintenance</html>"); return; }
  res.setHeader("Content-Type", "application/json");
  if (failure === "provider") {
    res.end(JSON.stringify({ header: { status: { name: "Fail", code: 1 } } }));
    return;
  }
  const fixture = path.resolve(__dirname, "../../../tests/fixtures/finance029", `${id}-${lang}.json`);
  res.end(fs.readFileSync(fixture));
}).listen(process.env.PORT || 4902);
