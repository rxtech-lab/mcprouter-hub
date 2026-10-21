// Local-only replay of official fixtures for the four retained tools.
/* eslint-disable @typescript-eslint/no-require-imports -- Postman loads CommonJS handlers. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
/* eslint-enable @typescript-eslint/no-require-imports */
const endpoints = { "hk-interbank-ir-daily": "hkma_hibor" };
http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const endpoint = url.pathname.split("/").at(-1);
  let file;
  if (url.pathname.endsWith("/json/local/search")) file = "address-local.json";
  else if (url.pathname.endsWith("/json/foreign/search")) file = "address-foreign.json";
  else if (url.pathname === "/open-data/licensees.csv") file = "tcsp.csv";
  else if (/^\/filemanager\/common\/csv\/(en|tc|sc)\/list_of_warehouse_\1\.csv$/.test(url.pathname)) file = `warehouse-${url.pathname.split("/")[4]}.csv`;
  else if (url.pathname.startsWith("/public/") && endpoints[endpoint]) file = `${endpoints[endpoint]}.json`;
  if (req.method !== "GET" || !file) { res.writeHead(501).end("Endpoint not defined by the official fixture contract"); return; }
  if (endpoint === "search" && (!url.searchParams.has("query[0][key3]") || !["Brn", "Comp_name"].includes(url.searchParams.get("query[0][key1]")))) { res.writeHead(501).end("Invalid registry search contract"); return; }
  if (endpoint === "hk-interbank-ir-daily" && url.searchParams.get("segment") !== "hibor.fixing") { res.writeHead(501).end("Invalid HIBOR segment"); return; }
  const failure = req.headers["x-fixture-failure"];
  if (failure === "blocked") { res.writeHead(405, { "Content-Type": "text/html" }).end("<html><title>405</title>Request blocked</html>"); return; }
  if (failure === "http") { res.writeHead(503).end("Maintenance"); return; }
  if (failure === "parse") { res.end("<html>Maintenance</html>"); return; }
  if (failure === "provider") { res.end(JSON.stringify({ header: { success: false, err_code: "TEST" } })); return; }
  if (failure === "malformed") { res.end(JSON.stringify({ header: { success: true }, result: { datasize: 1, records: [{}] } })); return; }
  res.setHeader("Content-Type", file.endsWith(".csv") ? "text/csv; charset=utf-8" : "application/json");
  let body = fs.readFileSync(path.resolve(__dirname, "../../../tests/fixtures/finance035", file), "utf8");
  if (endpoints[endpoint]) {
    const data = JSON.parse(body);
    const offset = Number(url.searchParams.get("offset") || 0);
    const size = Number(url.searchParams.get("pagesize") || 20);
    data.result.records = data.result.records.slice(offset, offset + size);
    data.result.datasize = data.result.records.length;
    body = JSON.stringify(data);
  }
  res.end(body);
}).listen(process.env.PORT || 4905);
