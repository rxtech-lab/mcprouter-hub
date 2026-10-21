/* eslint-disable @typescript-eslint/no-require-imports -- Postman uses CommonJS. */
// Source: Stripe portal-deep-links/API docs and rx-subscription /plan-changes.
// Owner mock search was skipped after the Postman CLI reported it was signed out.
const http = require("node:http");
function fields(body) {
  if (typeof body === "string") return new URLSearchParams(body);
  const result = new URLSearchParams();
  function walk(value, prefix) {
    if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) walk(child, prefix ? `${prefix}[${key}]` : key);
    else result.set(prefix, String(value));
  }
  walk(body, "");
  return result;
}
let provider = { sourceId: "old", planId: "old", oldAmount: 1000, newAmount: 2000, invoicedCents: 0, effectiveAt: null, setupMetadata: {} };
const boundary = 1898726400;
http.createServer(async (req, res) => {
  const json = (status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  const data = fields(req.body);
  if (req.method === "POST" && req.url === "/test/ui") {
    provider.uiMode = data.get("provider"); provider.oldAmount = Number(data.get("oldAmount")); provider.newAmount = Number(data.get("newAmount"));
    return json(200, provider);
  }
  if (req.method === "GET" && req.url === "/test/ui") return json(200, provider);
  if (req.method === "POST" && req.url === "/test/reset") {
    provider = { sourceId: data.get("sourceId"), planId: data.get("sourceId"), oldAmount: Number(data.get("oldAmount")), newAmount: Number(data.get("newAmount")), invoicedCents: 0, effectiveAt: null, setupMetadata: {} };
    return json(200, provider);
  }
  if (req.method === "POST" && req.url === "/test/advance") {
    if (provider.effectiveAt && Number(data.get("now")) >= provider.effectiveAt) { provider.planId = "new"; provider.invoicedCents = provider.newAmount; }
    return json(200, provider);
  }
  if (req.method === "POST" && req.url === "/checkout/sessions") {
    if (data.get("mode") !== "setup") return json(400, { error: { message: "Deferred changes must only set up payment" } });
    for (const key of ["kind", "applicationId", "appUserId", "sourceSubscriptionId", "sourcePlanId", "targetPlanId", "effectiveAt", "targetPriceId"]) provider.setupMetadata[key] = data.get(`metadata[${key}]`);
    return json(200, { id: "cs_setup", object: "checkout.session", url: "https://checkout.stripe.com/c/pay/simulated-setup" });
  }
  if (req.method === "GET" && req.url === "/checkout/sessions/cs_setup") return json(200, { id: "cs_setup", object: "checkout.session", status: "complete", mode: "setup", setup_intent: "seti_good", customer: "cus_good", metadata: provider.setupMetadata });
  if (req.method === "GET" && req.url === "/setup_intents/seti_good") return json(200, { id: "seti_good", status: "succeeded", payment_method: "pm_good", customer: "cus_good" });
  if (req.method === "POST" && req.url === "/subscription_schedules") {
    if (!data.get("from_subscription")) {
      if (data.get("phases[0][items][0][price]") !== "price_new") return json(400, { error: { message: "Unknown target price" } });
      provider.effectiveAt = Number(data.get("start_date"));
    }
    return json(200, { id: "sched_good", object: "subscription_schedule", phases: [{ start_date: boundary - 30 * 86400 }] });
  }
  if (req.method === "POST" && req.url === "/subscription_schedules/sched_good") {
    if (data.get("phases[0][items][0][price]") !== "price_old" || data.get("phases[1][items][0][price]") !== "price_new" || data.get("proration_behavior") !== "none") return json(400, { error: { message: "Invalid scheduled phase transition" } });
    provider.effectiveAt = Number(data.get("phases[0][end_date]"));
    return json(200, { id: "sched_good", object: "subscription_schedule" });
  }
  if (req.method === "GET" && req.url === "/subscriptions/sub_good") return json(200, {
    id: "sub_good", object: "subscription", customer: "cus_good", status: "active", collection_method: "charge_automatically",
    metadata: { applicationId: "app", appUserId: "user", planId: provider.sourceId },
    items: { data: [{ id: "si_good", quantity: 1, current_period_start: provider.planId === "new" ? boundary : boundary - 30 * 86400, current_period_end: provider.planId === "new" ? boundary + 30 * 86400 : boundary, price: { id: provider.planId === "new" ? "price_new" : "price_old", unit_amount: provider.planId === "new" ? provider.newAmount : provider.oldAmount, metadata: { applicationId: "app", planId: provider.planId } } }] },
  });
  if (req.method === "GET" && req.url === "/prices/price_new") return json(200, { id: "price_new", product: "prod_new", object: "price" });
  if (req.method === "GET" && req.url.startsWith("/api/v1/catalog")) return json(200, {
    plans: [{ id: "old", key: "payg", name: "Pay as you go", planGroup: "default", billingInterval: "month", intervalCount: 1, priceAmountCents: provider.uiMode ? provider.oldAmount : 0, currency: "usd", trialDays: 0, autoSubscribe: provider.uiMode === "internal" },
      { id: "new", key: "pro", name: "Pro", planGroup: "default", billingInterval: "month", intervalCount: 1, priceAmountCents: provider.uiMode ? provider.newAmount : 1500, currency: "usd", trialDays: 0, autoSubscribe: false }], topups: [],
  });
  if (req.method === "GET" && req.url.startsWith("/api/v1/entitlements")) return json(200, {
    user: { id: "local", rxlabUserId: "local-development-user" },
    plans: provider.uiMode === "internal" ? [] : [{ subscriptionId: "local", planId: "old", planKey: "payg", planName: "Pay as you go", planGroup: "default", status: "active", billingProvider: "stripe", currentPeriodEnd: new Date(boundary * 1000).toISOString(), cancelAtPeriodEnd: false }],
    defaultPlans: provider.uiMode === "internal" ? [{ subscriptionId: "local", planId: "old", planKey: "payg", planName: "Pay as you go", planGroup: "default", status: "active", billingProvider: "internal", currentPeriodEnd: new Date(boundary * 1000).toISOString(), cancelAtPeriodEnd: false }] : [], complimentaryPlans: [], balances: [], usage: [], roles: [], permissions: [],
  });
  if (req.method === "POST" && req.url === "/billing_portal/configurations") {
    if (data.get("features[subscription_update][products][0][prices][0]") !== "price_new" || data.get("features[subscription_update][proration_behavior]") !== "always_invoice") return json(400, { error: { type: "invalid_request_error", message: "Invalid plan review configuration" } });
    return json(200, { id: "bpc_good", object: "billing_portal.configuration" });
  }
  if (req.method === "POST" && req.url === "/billing_portal/sessions") {
    if (data.get("flow_data[type]") !== "subscription_update_confirm" || data.get("flow_data[subscription_update_confirm][items][0][price]") !== "price_new" || data.get("customer") !== "cus_good") return json(400, { error: { type: "invalid_request_error", message: "Invalid plan review flow" } });
    return json(200, { id: "bps_good", object: "billing_portal.session", url: "https://billing.stripe.com/p/session/simulated" });
  }
  if (req.method === "POST" && req.url === "/api/v1/plan-changes") {
    if (data.get("rxlabUserId") === "refused") return json(400, { error: "invalid_request", error_description: "Only active Stripe subscriptions can change plans here" });
    if (!["user", "local-development-user"].includes(data.get("rxlabUserId")) || data.get("subscriptionId") !== "local" || data.get("planId") !== "new") return json(400, { error: "invalid_request" });
    provider.lastTiming = data.get("timing");
    return json(200, { url: provider.lastTiming === "next_period" ? "https://checkout.stripe.com/c/pay/simulated-setup" : "https://billing.stripe.com/p/session/simulated" });
  }
  return json(501, { error: "not_modeled" });
}).listen(process.env.PORT);
