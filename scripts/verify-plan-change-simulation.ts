/** RX_SUBSCRIPTION_URL=http://127.0.0.1:4922/subscription RX_SUBSCRIPTION_API_KEY=simulation bun --conditions=react-server scripts/verify-plan-change-simulation.ts */
import assert from "node:assert/strict";
import { createPlanChangeSession, SubscriptionApiError } from "@/lib/billing/subscription";
import type { AppUser } from "@/lib/auth";
const input = { user: { id: "user" } as AppUser, subscriptionId: "local", planId: "new", returnUrl: "https://example.test/billing" };
assert.equal((await createPlanChangeSession(input)).url, "https://billing.stripe.com/p/session/simulated");
await assert.rejects(createPlanChangeSession({ ...input, user: { id: "refused" } as AppUser }), (error: unknown) => error instanceof SubscriptionApiError && error.status === 400 && error.code === "invalid_request");
console.log("PASS: McpRouter plan review client and subscription refusal over HTTP.");
