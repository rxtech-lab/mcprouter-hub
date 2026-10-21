/* eslint-disable @typescript-eslint/no-require-imports -- Postman runs CommonJS handlers. */
// Contract checked against rx-subscription's /api/v1/balances and debitBalance implementation.
// Owner mock discovery was unavailable: the local Postman CLI is signed out.
const http = require("node:http");
const users = new Map();
http.createServer(async (req, res) => {
  const json = (status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  if (req.method !== "POST" || req.url !== "/api/v1/balances") return json(501, { error: "not_modeled" });
  const input = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  if (input.unit !== "chat" || input.operation !== "debit" || input.amount !== 1 || !input.idempotencyKey || !["web", "telegram", "whatsapp"].includes(input.metadata?.channel)) return json(400, { error: "invalid_request" });
  if (input.rxlabUserId === "unavailable") return json(503, { error: "unavailable" });
  const user = users.get(input.rxlabUserId) || { used: 0, balance: 3, keys: new Map() };
  users.set(input.rxlabUserId, user);
  if (user.keys.has(input.idempotencyKey)) return json(200, { ...user.keys.get(input.idempotencyKey), duplicate: true });
  if (user.balance <= 0) return json(409, { error: "insufficient_balance" });
  user.balance--;
  user.used++;
  const result = { entryId: `entry-${user.used}`, duplicate: false, balanceAfter: user.balance };
  user.keys.set(input.idempotencyKey, result);
  json(200, result);
}).listen(process.env.PORT);
