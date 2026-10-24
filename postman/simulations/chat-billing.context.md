# Usage billing simulation

## Purpose

Runs the real chat gate, MCP meter and RxSubscription HTTP client against
`postman/mocks/chat-billing/default.js`. Fixtures follow the sibling
rx-subscription `/api/v1/usage` implementation, with deliberately small allowances.

## Execution

1. `postman simulation run postman/simulations/chat-billing.sim.yaml --port 4921 --output ndjson`
2. `BILLING_ENABLED=true RX_SUBSCRIPTION_URL=http://127.0.0.1:4921/subscription RX_SUBSCRIPTION_API_KEY=simulation bun --conditions=react-server scripts/verify-chat-billing-simulation.ts`

## Assumptions

- 2026-10-25: Owner mock lookup is unavailable because Postman CLI is signed out.
  Local fixtures validate HTTP requests and behavior, not live plan configuration.
- 2026-10-25: RxSubscription alone applies overage balance charges. The stand-in
  rejects direct balance calls so an accidental extra debit fails the verification.

## Observations

<!-- begin:observations -->
- 2026-10-25: The subscription member served all requests from the real chat gate,
  MCP meter and client. Verification passed finite/unlimited chat and matching-point overage, stable message
  idempotency, included ordinary tools, standard allowance then balance overage,
  premium charges during chat, independent point wallets, zero-limit Pay as you go,
  exhaustion and a 503 outage. No direct balance
  endpoint was called. This does not establish live user billing or deployment.
<!-- end:observations -->
