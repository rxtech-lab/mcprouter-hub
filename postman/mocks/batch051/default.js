// Local replay of the official Batch051 captures, not an implementation of the MCP tools.
/* eslint-disable @typescript-eslint/no-require-imports -- Postman uses CommonJS. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
/* eslint-enable @typescript-eslint/no-require-imports */
http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const route = url.pathname;
  const lang = url.searchParams.get("lang") || "en";
  let file;
  if (route === "/api.hkma.gov.hk/public/financial-market-infra/trade-repository/hktr-data-disclose-ir" && url.searchParams.get("segment") === "positions") file = "2336.json";
  if (route === "/api.hkma.gov.hk/public/financial-market-infra/trade-repository/list-of-tr-member-with-lei") file = "2337.json";
  if (route === "/www.als.gov.hk/lookup" && url.searchParams.get("q")) file = "0049.json";
  if (route === "/www.info.gov.hk/gia/rss/general_en.xml") file = "0052-en.xml";
  if (route === "/www.info.gov.hk/gia/rss/general_zh.xml") file = "0052-tc.xml";
  if (route === "/sc.isd.gov.hk/TuniS/www.info.gov.hk/gia/rss/general_zh.xml") file = "0052-sc.xml";
  const tables = { "325-43001": "0573", "325-43002": "0574", "325-43011": "0575" };
  if (route === "/www.censtatd.gov.hk/api/get.php" && tables[url.searchParams.get("id")] && ["en", "tc", "sc"].includes(lang) && url.searchParams.get("full_series") === "1") file = `${tables[url.searchParams.get("id")]}-${lang}.json`;
  if (route === "/portal.csdi.gov.hk/server/rest/services/common/ird_rcd_1668166144542_67785/FeatureServer/0/query") file = "2598.json";
  if (route === "/portal.csdi.gov.hk/server/rest/services/common/lcsd_rcd_1634540558875_77434/FeatureServer/0/query") file = "0051.json";
  if (req.method !== "GET" || !file) { res.writeHead(501).end("Endpoint not defined by captured Batch051 contracts"); return; }
  const failure = req.headers["x-fixture-failure"];
  if (failure === "http") { res.writeHead(503).end("Maintenance"); return; }
  if (failure === "parse") { res.writeHead(200).end("<html>Maintenance</html>"); return; }
  if (failure === "provider") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ header: { success: false, err_code: "E1", status: { name: "Fail", code: 1 } }, error: { code: 400, message: "Query rejected" } })); return; }
  if (failure === "malformed") { res.end("{}"); return; }
  const content = fs.readFileSync(path.resolve(__dirname, "../../../tests/fixtures/batch051", file));
  res.setHeader("Content-Type", file.endsWith("xml") ? "application/xml" : "application/json");
  res.end(content);
}).listen(process.env.PORT || 4911);
