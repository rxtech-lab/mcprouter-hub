/** BILLING_ENABLED=true RX_SUBSCRIPTION_URL=http://127.0.0.1:4921/subscription RX_SUBSCRIPTION_API_KEY=simulation bun --conditions=react-server scripts/verify-chat-billing-simulation.ts */
import assert from "node:assert/strict";
import { consumeChatMessage, DuplicateChatMessageError } from "@/lib/billing/chat";
import { UsageLimitError } from "@/lib/billing/errors";
import { meterToolCall } from "@/lib/mcp/meter";

const userId = `simulation-${crypto.randomUUID()}`;
const first = await consumeChatMessage({ userId, messageId: "one", channel: "telegram" });
assert.equal(first?.remaining, 2);
await assert.rejects(consumeChatMessage({ userId, messageId: "one", channel: "telegram" }), DuplicateChatMessageError);
const second = await consumeChatMessage({ userId, messageId: "two", channel: "whatsapp" });
assert.equal(second?.remaining, 1);
const paid = await consumeChatMessage({ userId, messageId: "three", channel: "web" });
assert.equal(paid?.remaining, 0);
const chatOverage = await consumeChatMessage({ userId, messageId: "four", channel: "web" });
assert.equal(chatOverage?.chargedUnits, 1);
await assert.rejects(consumeChatMessage({ userId, messageId: "five", channel: "web" }), UsageLimitError);
await assert.rejects(consumeChatMessage({ userId: "unavailable", messageId: "one", channel: "web" }), /rx-subscription/);
// A metered chat may use multiple tools without another subscription event or balance debit.
const unexpectedBilling = async (): Promise<never> => { throw new Error("Unexpected tool charge"); };
for (let index = 0; index < 3; index++) {
  const result = await meterToolCall({ userId, apiKeyId: null, scopes: [], channel: "telegram", chatMetered: true },
    { service: "simulation", tool: "lookup" }, async () => ({ ok: true }),
    { billingEnabled: true, record: unexpectedBilling, log: async () => {}, defer: () => {} });
  assert.equal(result.isError, undefined);
}
const unlimited = await consumeChatMessage({ userId: "unlimited", messageId: crypto.randomUUID(), channel: "web" });
assert.equal(unlimited?.limit, null);
assert.equal(unlimited?.remaining, null);
// Real meter and subscription client: no local balance debit, including overage.
let ran = 0;
const tool = async () => { ran++; return { ok: true }; };
const deps = { billingEnabled: true, log: async () => {}, increment: async () => {}, defer: () => {} };
const direct = { userId, apiKeyId: null, scopes: [], channel: "oauth" as const };
for (let i = 0; i < 3; i++) assert.equal((await meterToolCall(direct, { service: "hko-weather", tool: "weather" }, tool, deps)).isError, undefined);
assert.equal((await meterToolCall(direct, { service: "hko-weather", tool: "weather" }, tool, deps)).isError, true);
assert.equal(ran, 3);
const premium = { ...direct, chatMetered: true, channel: "web" as const };
assert.equal((await meterToolCall(premium, { service: "unified-news", tool: "search_news" }, tool, deps)).isError, undefined);
assert.equal((await meterToolCall(premium, { service: "unified-news", tool: "get_news_detail" }, tool, deps)).isError, true);
assert.equal(ran, 4);
// Zero included usage spends only the matching point pool, never another meter's points.
const payg = { ...direct, userId: `payg-${crypto.randomUUID()}` };
assert.equal((await consumeChatMessage({ userId: payg.userId, messageId: "one", channel: "web" }))?.chargedUnits, 1);
await assert.rejects(consumeChatMessage({ userId: payg.userId, messageId: "two", channel: "web" }), UsageLimitError);
for (const service of ["hko-weather", "unified-news"]) {
  assert.equal((await meterToolCall(payg, { service, tool: "lookup" }, tool, deps)).isError, undefined);
  assert.equal((await meterToolCall(payg, { service, tool: "lookup" }, tool, deps)).isError, true);
}
assert.equal(ran, 6);
assert.equal((await meterToolCall({ ...direct, userId: "unavailable" }, { service: "unified-news", tool: "search_news" }, tool, deps)).isError, true);
assert.equal(ran, 6);
console.log("PASS: allowances then matching point fallback, independent chat/MCP/premium wallets, zero-limit pay-as-you-go, unlimited plans, idempotency, premium chat charges, exhaustion and billing outage.");
