# Billing plan changes

McpRouter renders plan eligibility on the server. The dialog persists `timing=immediate|next_period` in the URL, offers both options for upgrades, and offers only next-period changes for downgrades. An owned Stripe subscription in the same group opens `/billing?changePlan=<planId>` in a native modal dialog. The authenticated server action reloads catalogue and ownership before calling rx-subscription; the browser never chooses a user or subscription ID. Automatic free defaults also offer the timing dialog; immediate upgrades use checkout, while next-period upgrades save a payment method and schedule the paid plan at the free period boundary. Unsupported providers and one-time purchases are not switched through checkout.

Deploy rx-subscription's `POST /api/v1/plan-changes` and price-based webhook sync before this UI. The endpoint uses the existing `checkout.create` key scope. Stripe hosts confirmation for immediate upgrades and payment-method setup for deferred changes. The backend schedules a deferred change only after confirmed setup; current access remains until renewal. Return navigation only acknowledges the review; confirmed webhook state determines access. No database migration is required.

## Local verification

Start `postman simulation run postman/simulations/plan-change.sim.yaml --port 4922 --output ndjson`.

Run `RX_SUBSCRIPTION_URL=http://127.0.0.1:4922/subscription RX_SUBSCRIPTION_API_KEY=simulation bun --conditions=react-server scripts/verify-plan-change-simulation.ts` for the real McpRouter HTTP client.

Run `PLAN_CHANGE_SIMULATION=true RX_SUBSCRIPTION_URL=http://127.0.0.1:4922/subscription RX_SUBSCRIPTION_API_KEY=simulation bunx playwright test e2e/billing-plan-change.spec.ts` for the fixture billing page. The Playwright configuration supplies development authentication. Stripe navigation is intercepted by the test and does not contact Stripe.

The sibling service has `lib/stripe/plan-change-simulation.test.ts` and `lib/stripe/deferred-plan-change-simulation.test.ts`: run with `IS_E2E=true E2E_STRIPE_API_BASE=http://127.0.0.1:4922 STRIPE_SANDBOX_SECRET_KEY=sk_test_simulation`. It runs the real Stripe SDK against the simulation with database ownership and mirrored prices supplied as fixtures. Mock responses follow Stripe's portal confirmation contract and the local rx-subscription route. Published owner-mock discovery was unavailable because the Postman CLI was signed out.

Before production, verify a Stripe sandbox change, abandoned confirmation, failed payment/3DS, and delivery/replay of the subscription webhook. Local simulation does not establish those live provider results.

The timing matrix covers free/no-payment upgrades now or next period, $10 to $20 upgrades now or next period, blocked immediate downgrades, and $20 to $10 downgrades at renewal. Provider time advancement in the simulation verifies unchanged access before the boundary and the new price/access at the boundary. Exact Stripe invoices remain a sandbox verification requirement.

## Automatic Free targets and top-ups

An existing subscription can select an automatic Free plan through the change dialog; Free still cannot be purchased through normal checkout. Downgrades default to next-period timing. This requires a backend version that accepts automatic Free targets in `/plan-changes`.

Top-up availability follows the user-specific catalogue `eligible` and `blockedBy` fields. Plus is not blocked by a frontend rule. Configure the backend top-up eligibility to admit Plus; do not bypass a backend refusal in the UI.
