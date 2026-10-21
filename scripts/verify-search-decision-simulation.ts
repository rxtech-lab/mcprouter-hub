/** Start postman/simulations/search-decision.sim.yaml on port 4918 first. */
import assert from "node:assert/strict";
import { createGateway } from "ai";
import { decideSearchIntent } from "@/lib/site-search/decision";
const model = createGateway({ baseURL: "http://127.0.0.1:4918/gateway", apiKey: "local-simulation-only" }).decisionModel("typesafe-ai/jev");
for (const [query, expected] of [["weather", "search"], ["What's the weather now?", "chat"], ["明天會下雨嗎？", "chat"]]) {
  assert.equal(await decideSearchIntent(query, { model }), expected);
}
await assert.rejects(decideSearchIntent("invalid response", { model }));
await assert.rejects(decideSearchIntent("provider outage", { model }));
console.log("PASS: AI SDK Decision API over HTTP — search, questions, Chinese, invalid response and upstream outage.");
