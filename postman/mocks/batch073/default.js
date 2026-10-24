// Local replay of five usable official resource captures. Not a provider availability claim.
/* eslint-disable @typescript-eslint/no-require-imports -- Postman loads CommonJS handlers. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
/* eslint-enable @typescript-eslint/no-require-imports */
const routes = {
  "/corporate/companydirectory/v1": "2414",
  "/corporate/recruitment/v1": "2418",
  "/corporate/figures/laboffice/v1": "2420",
  "/server/rest/services/common/hkma_rcd_1640054678975_66504/FeatureServer/0/query": "2190",
  "/server/rest/services/common/hkpo_rcd_1639016844639_48104/FeatureServer/0/query": "2430",
};
http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const id = routes[url.pathname.replace(/\/$/, "")];
  if (req.method !== "GET" || !id) { res.writeHead(501).end("Endpoint not defined by the batch073 source contracts"); return; }
  const failure = req.headers["x-fixture-failure"];
  if (failure === "http") { res.writeHead(503).end("<html>Maintenance</html>"); return; }
  if (failure === "json") { res.end("<html>Maintenance</html>"); return; }
  res.setHeader("Content-Type", "application/json");
  const file = id;
  let body = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../tests/fixtures/batch073", `${file}.json`), "utf8"));
  if (["2190", "2430"].includes(id)) {
    body.features = body.features.slice(Number(url.searchParams.get("resultOffset") || 0), Number(url.searchParams.get("resultOffset") || 0) + Number(url.searchParams.get("resultRecordCount") || 20));
    body.exceededTransferLimit = false;
  }
  if (failure === "malformed") body = { unexpected: true };
  if (failure === "empty") {
    if (["2190", "2430"].includes(id)) body.features = [];
    else if (id === "2414") body.value = [];
    else if (id === "2418") body = [];
    else body = { item: "", value: null };
  }
  res.end(JSON.stringify(body));
}).listen(process.env.PORT || 4973);
