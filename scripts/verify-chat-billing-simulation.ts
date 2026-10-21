/** BILLING_ENABLED=true RX_SUBSCRIPTION_URL=http://127.0.0.1:4921/subscription RX_SUBSCRIPTION_API_KEY=simulation bun --conditions=react-server scripts/verify-chat-billing-simulation.ts */
import assert from "node:assert/strict";
import { consumeChatMessage, DuplicateChatMessageError } from "@/lib/billing/chat";
import { UsageLimitError } from "@/lib/billing/errors";
import { meterToolCall } from "@/lib/mcp/meter";

const userId = `simulation-${crypto.randomUUID()}`;
const first = await consumeChatMessage({ userId, messageId: "one", channel: "telegram" });
assert.equal(first?.balanceAfter, 2);
await assert.rejects(consumeChatMessage({ userId, messageId: "one", channel: "telegram" }), DuplicateChatMessageError);
const second = await consumeChatMessage({ userId, messageId: "two", channel: "whatsapp" });
assert.equal(second?.balanceAfter, 1);
const paid = await consumeChatMessage({ userId, messageId: "three", channel: "web" });
assert.equal(paid?.balanceAfter, 0);
await assert.rejects(consumeChatMessage({ userId, messageId: "four", channel: "web" }), UsageLimitError);
await assert.rejects(consumeChatMessage({ userId: "unavailable", messageId: "one", channel: "web" }), /rx-subscription/);
// A metered chat may use multiple tools without another subscription event or balance debit.
const unexpectedBilling = async (): Promise<never> => { throw new Error("Unexpected tool charge"); };
for (let index = 0; index < 3; index++) {
  const result = await meterToolCall({ userId, apiKeyId: null, scopes: [], channel: "telegram", chatMetered: true },
    { service: "simulation", tool: "lookup" }, async () => ({ ok: true }),
    { billingEnabled: true, record: unexpectedBilling, debit: unexpectedBilling, log: async () => {}, defer: () => {} });
  assert.equal(result.isError, undefined);
}
console.log("PASS: shared balance, one unit/message, retries, zero-balance refusal, billing outage and included tools.");
