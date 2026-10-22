// Local replay of literal official JSON captures. No published owner mock was available locally.
/* eslint-disable @typescript-eslint/no-require-imports -- Postman loads CommonJS. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
/* eslint-enable @typescript-eslint/no-require-imports */
const directory = path.resolve(__dirname,"../../../tests/fixtures/health027");
const entries = JSON.parse(fs.readFileSync(path.join(directory,"manifest.json"),"utf8"));
http.createServer((req,res) => {
  const url = new URL(req.url,"http://localhost");
  const entry = entries.find((e) => { const published=new URL(e.url); return published.pathname===url.pathname && published.search===url.search; });
  if (req.method!=="GET" || !entry) { res.writeHead(501).end("Request outside captured official contract"); return; }
  const failure=req.headers["x-fixture-failure"];
  if (failure==="http") {res.writeHead(503).end("Maintenance");return;}
  if (failure==="parse") {res.writeHead(200,{"Content-Type":"text/html"}).end("<html>Maintenance</html>");return;}
  res.setHeader("Content-Type","application/json");
  if (failure==="malformed") {res.end(JSON.stringify(["dhce","wws"].includes(entry.kind)?{features:[{attributes:{},geometry:{x:114,y:22}}]}:[{}]));return;}
  res.end(fs.readFileSync(path.join(directory,entry.file),"utf8"));
}).listen(process.env.PORT || 4927);
