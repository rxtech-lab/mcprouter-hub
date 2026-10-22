/* eslint-disable @typescript-eslint/no-require-imports -- Local Postman replay uses CommonJS. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname,"../../../tests/fixtures/health025");
const entries = JSON.parse(fs.readFileSync(path.join(root,"manifest.json"),"utf8"));
http.createServer((req,res)=>{
  const u=new URL(req.url,"http://localhost");
  const table=entries.find((e)=>e.table===u.searchParams.get("id"));
  const clinic=u.pathname==="/server/rest/services/common/csb_rcd_1699849584071_18909/FeatureServer/0/query";
  const flu=u.pathname==="/files/misc/flux_data.csv";
  if(req.method!=="GET" || !(table && u.pathname==="/api/get.php" || clinic || flu)){res.writeHead(501);return res.end("Endpoint not modeled");}
  const fault=req.headers["x-fixture-failure"];
  if(fault==="http"){res.writeHead(503);return res.end("<html>Maintenance</html>");}
  if(fault==="html")return res.end("<html>Invalid source format</html>");
  if(fault==="malformed")return res.end("{}");
  const lang=u.searchParams.get("lang")||"en";
  if(!["en","tc","sc"].includes(lang)){res.writeHead(400);return res.end("Invalid language");}
  const file=table?`${table.id}-${lang}.json`:clinic?"API-1292.json":"API-0044.csv";
  let body=fs.readFileSync(path.join(root,file),"utf8");
  if(fault==="empty"){
    if(flu) body=body.split("\n")[0];
    else {const j=JSON.parse(body);if(clinic)j.features=[];else j.dataSet=[];body=JSON.stringify(j);}
  }
  res.end(body);
}).listen(process.env.PORT||4925);
