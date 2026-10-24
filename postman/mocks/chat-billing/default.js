/* eslint-disable @typescript-eslint/no-require-imports -- Postman runs CommonJS handlers. */
// Contract checked against rx-subscription's /api/v1/usage route and usage implementation.
// Owner mock discovery was unavailable: the local Postman CLI is signed out.
const http = require("node:http");
const users = new Map();
http.createServer(async (req, res) => {
  const json = (status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  if (req.headers["x-api-key"] !== "simulation") return json(401, { error: "invalid_api_key" });
  const path = new URL(req.url, "http://localhost").pathname;
  if (req.method === "GET") {
    if (path === "/api/v1/entitlements") { return json(200, {
      user: { id: "simulation", rxlabUserId: "local-development-user", level: null, levelKey: null },
      plans: [], defaultPlans: [], complimentaryPlans: [], roles: [], permissions: [],
      balances: [{ unit: "mcp-calls", name: "MCP credits", amount: 7, available: 7, precision: 0, symbol: null }],
      usage: [
        { key: "chat", name: "Chat", used: 1, limit: null, remaining: null, resetsAt: null, resetPolicy: "calendar_period" },
        { key: "mcp_calls", name: "MCP calls", used: 1, limit: 2, remaining: 1, resetsAt: null, resetPolicy: "calendar_period" },
        { key: "premium_mcp", name: "Premium MCP calls", used: 0, limit: 0, remaining: 0, resetsAt: null, resetPolicy: "calendar_period" },
      ],
    }); }
    if (path === "/api/v1/catalog") {
      return json(200, { plans: [], topups: [{ id: "simulation-pack", key: "points-pack", name: "Points bundle", description: "Stored points for overage", unit: "mcp-calls", amount: 10000,
        grants: [{ unit: "chat", name: "Chat points", amount: 500 }, { unit: "premium_mcp", name: "Premium MCP points", amount: 50 }],
        priceAmountCents: 499, currency: "usd", eligible: true, blockedBy: [] }] });
    }
    if (path === "/api/v1/usage/statistics") return json(200, { totals: [] });
    if (path === "/api/v1/balances/ledger") return json(200, { entries: [], total: 0, page: 1, pageCount: 1 });
    return json(501, { error: "not_modeled" });
  }
  if (req.method !== "POST" || req.url !== "/api/v1/usage") return json(501, { error: "not_modeled" });
  const input = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  if (!["chat", "mcp_calls", "premium_mcp"].includes(input.item) || input.amount !== 1 || !input.idempotencyKey) return json(400, { error: "invalid_request" });
  if (input.rxlabUserId === "unavailable") return json(503, { error: "unavailable" });
  const user = users.get(input.rxlabUserId) || { counters: { chat: 0, mcp_calls: 0, premium_mcp: 0 }, points: { chat: 1, mcp_calls: 1, premium_mcp: 1 }, keys: new Map() };
  users.set(input.rxlabUserId, user);
  const eventKey = `${input.item}:${input.idempotencyKey}`;
  if (user.keys.has(eventKey)) return json(200, { ...user.keys.get(eventKey), duplicate: true });
  // Small synthetic allowances model blocking, unlimited and balance-backed policies.
  const limit = input.rxlabUserId.startsWith("payg-") ? 0 : input.item === "chat" ? (input.rxlabUserId === "unlimited" ? null : 3) : input.item === "mcp_calls" ? 2 : 0;
  const used = user.counters[input.item];
  const over = limit !== null && used >= limit;
  const base = { used, limit, remaining: limit === null ? null : Math.max(0, limit - used), periodEnd: null, duplicate: false, chargedUnits: 0 };
  if (over && user.points[input.item] <= 0) return json(402, { ...base, allowed: false, reason: "insufficient_balance" });
  if (over) user.points[input.item]--;
  user.counters[input.item]++;
  const result = { ...base, allowed: true, used: used + 1, remaining: limit === null ? null : Math.max(0, limit - used - 1), chargedUnits: over ? 1 : 0 };
  user.keys.set(eventKey, result);
  json(200, result);
}).listen(process.env.PORT);
