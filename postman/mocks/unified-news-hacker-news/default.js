/* eslint-disable @typescript-eslint/no-require-imports -- Postman handlers run as CommonJS. */
const http = require("node:http");
/* eslint-enable @typescript-eslint/no-require-imports */
// Synthetic examples following https://github.com/HackerNews/API.
const stories = {
  101: { id: 101, type: "story", title: "HN example", url: "https://example.com/story", time: 1729754280, score: 42, kids: [201] },
  102: { id: 102, type: "story", title: "Ask HN example", text: "<p>Example question</p>", time: 1729754281 },
  103: { id: 103, deleted: true },
  104: { id: 104, type: "job", title: "Example job" },
  105: { id: 105, type: "story", dead: true, title: "Dead story" },
  106: { id: 106, type: "story", title: "Unsafe URL", url: "javascript:alert(1)" },
  107: { id: 107, type: "story", title: "Large story", text: "x".repeat(91000) },
};
http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  // Fail if any RapidAPI credentials are accidentally forwarded.
  if (req.headers["x-rapidapi-key"] || req.headers["x-rapidapi-host"]) { res.writeHead(400).end(); return; }
  const path = new URL(req.url, "http://localhost").pathname;
  if (path.startsWith("/error/")) { res.writeHead(503).end("secret-echo-must-not-leak"); return; }
  if (path.startsWith("/json/")) { res.end("not json"); return; }
  if (path.startsWith("/malformed/")) { res.end(JSON.stringify(["101"])); return; }
  if (path === "/empty/topstories.json") { res.end("[]"); return; }
  if (path === "/topstories.json") { res.end(JSON.stringify([101, 101, 102, 103, 104, 105, 999, 106])); return; }
  if (path === "/bad-item/topstories.json") { res.end("[101]"); return; }
  if (path === "/bad-item/item/101.json") { res.end(JSON.stringify({ id: 999, type: "story", title: "Wrong item" })); return; }
  const match = path.match(/^\/item\/([0-9]+)\.json$/);
  if (req.method === "GET" && match) { res.end(JSON.stringify(stories[match[1]] || null)); return; }
  res.writeHead(501).end(JSON.stringify({ error: "Endpoint not modeled" }));
}).listen(process.env.PORT);
