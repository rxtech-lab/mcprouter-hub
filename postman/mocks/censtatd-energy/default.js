// Local-only replay of compact official C&SD responses captured on 2026-10-24.
/* eslint-disable @typescript-eslint/no-require-imports -- Postman loads mock handlers as CommonJS. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
/* eslint-enable @typescript-eslint/no-require-imports */
const tables = new Set(["915-91103", "915-91104", "915-91105", "915-91106", "915-91107", "915-91108", "915-91109", "915-91110", "915-91201", "915-91202"]);
http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const id = url.searchParams.get("id");
  const lang = url.searchParams.get("lang");
  if (req.method !== "GET" || url.pathname !== "/api/get.php" || !tables.has(id) || !["en", "tc", "sc"].includes(lang) || url.searchParams.get("full_series") !== "1") {
    res.writeHead(501).end("Endpoint not defined by the commerce and industry fixture contract");
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
  const fixture = path.resolve(__dirname, "../../../tests/fixtures/batch067", `${id}-${lang}.json`);
  const body = JSON.parse(fs.readFileSync(fixture, "utf8"));
  if (failure === "malformed") body.dataSet[body.dataSet.length - 1].figure = null;
  if (failure === "empty") { body.dataSet = []; body.header.count.noOfRecords = 0; }
  res.end(JSON.stringify(body));
}).listen(process.env.PORT || 4967);
