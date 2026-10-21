# Billing plan changes

McpRouter renders plan eligibility on the server. An owned Stripe subscription in the same group opens `/billing?changePlan=<planId>` in a native modal dialog. The authenticated server action reloads catalogue and ownership before calling rx-subscription; the browser never chooses a user or subscription ID. Automatic free defaults use new checkout. Unsupported providers and one-time purchases are not switched through checkout.

Deploy rx-subscription's `POST /api/v1/plan-changes` and price-based webhook sync before this UI. The endpoint uses the existing `checkout.create` key scope. Stripe hosts final confirmation, displays prorated charges, and handles payment authentication. Return navigation only acknowledges the review; confirmed webhook state determines access. No database migration is required.

## Local verification

Start `postman simulation run postman/simulations/plan-change.sim.yaml --port 4922 --output ndjson`.

Run `RX_SUBSCRIPTION_URL=http://127.0.0.1:4922/subscription RX_SUBSCRIPTION_API_KEY=simulation bun --conditions=react-server scripts/verify-plan-change-simulation.ts` for the real McpRouter HTTP client.

Run `PLAN_CHANGE_SIMULATION=true RX_SUBSCRIPTION_URL=http://127.0.0.1:4922/subscription RX_SUBSCRIPTION_API_KEY=simulation bunx playwright test e2e/billing-plan-change.spec.ts` for the fixture billing page. The Playwright configuration supplies development authentication. Stripe navigation is intercepted by the test and does not contact Stripe.

The sibling service also has `lib/stripe/plan-change-simulation.test.ts`: run with `IS_E2E=true E2E_STRIPE_API_BASE=http://127.0.0.1:4922 STRIPE_SANDBOX_SECRET_KEY=sk_test_simulation`. It runs the real Stripe SDK against the simulation with database ownership and mirrored prices supplied as fixtures. Mock responses follow Stripe's portal confirmation contract and the local rx-subscription route. Published owner-mock discovery was unavailable because the Postman CLI was signed out.

Before production, verify a Stripe sandbox change, abandoned confirmation, failed payment/3DS, and delivery/replay of the subscription webhook. Local simulation does not establish those live provider results.
