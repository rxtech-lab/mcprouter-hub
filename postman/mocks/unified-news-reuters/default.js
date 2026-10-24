/* eslint-disable @typescript-eslint/no-require-imports -- Postman handlers run as CommonJS. */
const http = require("node:http");
/* eslint-enable @typescript-eslint/no-require-imports */
// Synthetic structural examples of the observed latest array and detail envelope.
const articles = [0, 1, 2].map((i) => ({ title: `Reuters example ${i}`,
  link: `https://www.reuters.com/world/example-${i}/`, published_at: "2026-10-24T07:18:00+08:00" }));
http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.headers["x-rapidapi-host"] !== "reuters-api.p.rapidapi.com" || !req.headers["x-rapidapi-key"]) {
    res.writeHead(401).end(JSON.stringify({ message: "Missing auth" })); return;
  }
  const url = new URL(req.url, "http://localhost");
  if (req.headers["x-rapidapi-key"] === "simulation-both-error") { res.writeHead(503).end("secret-echo-must-not-leak"); return; }
  if (req.method === "GET" && url.pathname === "/latest") {
    res.end(JSON.stringify(articles.slice(0, Number(url.searchParams.get("limit"))))); return;
  }
  if (req.method === "GET" && url.pathname === "/details") {
    const article = articles.find((a) => a.link === url.searchParams.get("url"));
    if (!article) { res.writeHead(404).end(JSON.stringify({ status: "error" })); return; }
    res.end(JSON.stringify({ status: "success", message: null, data_source: "live", data: {
      title: article.title, url: article.link, content: "Example wire dispatch.", author: "Reuters",
    } })); return;
  }
  res.writeHead(501).end(JSON.stringify({ error: "Endpoint not modeled" }));
}).listen(process.env.PORT);
