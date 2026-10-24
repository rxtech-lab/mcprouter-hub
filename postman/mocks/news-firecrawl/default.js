/* eslint-disable @typescript-eslint/no-require-imports -- Postman executes CommonJS. */
const http = require("node:http");
// Synthetic fixtures from Firecrawl's official v2 search/scrape contracts.
let scrapes = 0;
http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/stats") { res.end(JSON.stringify({ scrapes })); return; }
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  if (req.headers.authorization !== "Bearer simulation-firecrawl" || req.headers["x-rapidapi-key"]) { res.writeHead(401).end(); return; }
  if (req.method === "POST" && req.url === "/v2/search") {
    if (!body.query || body.sources?.join() !== "news" || !Number.isInteger(body.limit)) { res.writeHead(422).end(); return; }
    if (body.query === "rate limit") { res.writeHead(429).end("secret-echo"); return; }
    if (body.query === "malformed") { res.end(JSON.stringify({ success: true, data: { news: [{}] } })); return; }
    res.end(JSON.stringify({ success: true, data: { news: body.query === "empty" ? [] : [
      { title: "Example news", url: "https://example.com/search-story", snippet: "Example snippet", date: "2026-10-25T00:00:00Z" },
    ] } })); return;
  }
  if (req.method === "POST" && req.url === "/v2/scrape") {
    scrapes++;
    if (!body.url || body.formats?.join() !== "markdown" || body.onlyMainContent !== true || body.maxAge !== 172800000 || body.parsers?.join() !== "pdf") { res.writeHead(422).end(); return; }
    if (body.url.includes("rate-limit")) { res.writeHead(429).end("secret-echo"); return; }
    if (body.url.includes("provider-error")) { res.end(JSON.stringify({ success: false, error: "secret-echo" })); return; }
    if (body.url.includes("invalid-json")) { res.end("not json secret-echo"); return; }
    if (body.url.includes("blocked")) { res.end(JSON.stringify({ success: true, data: { markdown: "Access denied", metadata: { statusCode: 403 } } })); return; }
    const markdown = body.url.includes("empty") ? " " : body.url.includes("oversized") ? "x".repeat(91000) : `# Article\n\nFull article body from ${body.url}`;
    res.end(JSON.stringify({ success: true, data: { markdown, metadata: { statusCode: 200 } } })); return;
  }
  res.writeHead(501).end(JSON.stringify({ error: "Endpoint not modeled" }));
}).listen(process.env.PORT);
