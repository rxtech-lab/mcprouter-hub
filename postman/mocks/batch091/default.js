// Official CSDI captures, no provider availability claim.
/* eslint-disable @typescript-eslint/no-require-imports -- Postman loads CommonJS handlers. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
/* eslint-enable @typescript-eslint/no-require-imports */
const folder = path.resolve(__dirname, "../../../tests/fixtures/batch091");
const manifest = JSON.parse(fs.readFileSync(path.join(folder, "manifest.json"), "utf8"));
http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const entry = manifest.find((c) => url.pathname === `/server/rest/services/common/${c.layer}/FeatureServer/${c.layerId}/query`);
  const layer = Number(url.pathname.match(/FeatureServer\/(\d+)\/query$/)?.[1]);
  if (req.method !== "GET" || !entry || !Number.isInteger(layer) || layer !== entry.layerId) { res.writeHead(501).end("Endpoint not in the captured contract"); return; }
  const failure = req.headers["x-fixture-failure"];
  if (failure === "http") { res.writeHead(503).end("<html>Maintenance</html>"); return; }
  if (failure === "json") { res.end("<html>Maintenance</html>"); return; }
  if (failure === "timeout") { setTimeout(() => res.end("{}"), 250); return; }
  const body = JSON.parse(fs.readFileSync(path.join(folder, `${entry.file}.json`), "utf8"));
  const offset = Number(url.searchParams.get("resultOffset") || 0);
  const limit = Number(url.searchParams.get("resultRecordCount") || 20);
  const objectId = url.searchParams.get("where")?.match(/OBJECTID=(\d+)/)?.[1];
  if (objectId) body.features = body.features.filter((f) => f.attributes.OBJECTID === Number(objectId));
  body.exceededTransferLimit = offset + limit < body.features.length;
  body.features = body.features.slice(offset, offset + limit);
  if (url.searchParams.get("returnGeometry") === "false") body.features.forEach((f) => delete f.geometry);
  if (failure === "empty") { body.features = []; body.exceededTransferLimit = false; }
  if (failure === "malformed") delete body.features[0]?.attributes;
  if (failure === "arcgis") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: { code: 400, message: "Invalid query" } })); return; }
  res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body));
}).listen(process.env.PORT || 4991);
