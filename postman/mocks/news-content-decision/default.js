/* eslint-disable @typescript-eslint/no-require-imports -- Postman executes CommonJS. */
const http = require("node:http");
// Synthetic Decision API wire fixtures; these do not measure live model accuracy.
http.createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (path === "/outage/decision-model") { res.writeHead(503).end("secret-echo"); return; }
  if (req.method !== "POST" || path !== "/decision-model") { res.writeHead(501).end(); return; }
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const article = body.stateParts?.find((part) => part.type === "json")?.value?.article;
  if (!article || !body.questions?.body?.criteria?.present || !body.questions?.body?.criteria?.missing) {
    res.writeHead(422).end("Expected article and body criteria"); return;
  }
  const choice = article.content || article.text ? "present" : "missing";
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ answers: { body: { type: "choice", choice } }, warnings: [] }));
}).listen(process.env.PORT);
