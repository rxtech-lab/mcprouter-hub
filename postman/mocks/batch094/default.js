// Derived from official C&SD JSON captures listed in the fixture manifest.
/* eslint-disable @typescript-eslint/no-require-imports -- Postman loads CommonJS handlers. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
/* eslint-enable @typescript-eslint/no-require-imports */
const folder = path.resolve(__dirname, "../../../tests/fixtures/batch094");
const manifest = JSON.parse(fs.readFileSync(path.join(folder, "manifest.json"), "utf8"));
http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const entry = manifest.find((c) => c.table === url.searchParams.get("id") && c.lang === url.searchParams.get("lang"));
  if (req.method !== "GET" || url.pathname !== "/api/get.php" || url.searchParams.get("full_series") !== "1" || !entry) {
    res.writeHead(501).end("Endpoint not in captured contract"); return;
  }
  const failure = req.headers["x-fixture-failure"];
  if (failure === "http") { res.writeHead(503).end("<html>Maintenance</html>"); return; }
  if (failure === "json") { res.end("<html>Maintenance</html>"); return; }
  if (failure === "timeout") { setTimeout(() => res.end("{}"), 250); return; }
  const body = JSON.parse(fs.readFileSync(path.join(folder, entry.file), "utf8"));
  if (failure === "empty") body.dataSet = [];
  if (failure === "malformed") delete body.dataSet[0].figure;
  if (failure === "provider") body.header.status = { code: 4, name: "Failure" };
  res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body));
}).listen(process.env.PORT || 4994);
