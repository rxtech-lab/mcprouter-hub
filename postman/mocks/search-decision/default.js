/* eslint-disable @typescript-eslint/no-require-imports -- Postman executes CommonJS. */
// Synthetic wire-contract fixtures from the installed AI SDK 7 GatewayDecisionModel.
// Tests transport/validation/failure handling, not the live model's semantic accuracy.
// Owner mock lookup skipped: the local Postman CLI is signed out.
const http = require("node:http");
http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/decision-model") { res.writeHead(501).end("Endpoint not modeled"); return; }
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const query = body.stateParts?.find((part) => part.type === "json")?.value?.query;
  if (!query || body.questions?.intent?.type !== "choice" || !body.questions.intent.criteria.search || !body.questions.intent.criteria.chat) {
    res.writeHead(422).end("Missing decision query or choice criteria"); return;
  }
  if (query === "provider outage") { res.writeHead(503, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Synthetic outage" })); return; }
  const choices = { weather: "search", "What's the weather now?": "chat", "明天會下雨嗎？": "chat", "invalid response": "execute" };
  if (!(query in choices)) { res.writeHead(501).end("Query fixture not modeled"); return; }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ answers: { intent: { type: "choice", choice: choices[query] } }, warnings: [] }));
}).listen(process.env.PORT);
