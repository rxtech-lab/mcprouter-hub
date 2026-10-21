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
http.createServer(async (req, res) => {
  const json = (status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  if (req.method === "GET" && req.url === "/subscriptions/sub_good") return json(200, {
    id: "sub_good", object: "subscription", customer: "cus_good", status: "active", collection_method: "charge_automatically",
    metadata: { applicationId: "app", appUserId: "user", planId: "old" },
    items: { data: [{ id: "si_good", quantity: 1, price: { id: "price_old", metadata: { applicationId: "app", planId: "old" } } }] },
  });
  if (req.method === "GET" && req.url === "/prices/price_new") return json(200, { id: "price_new", product: "prod_new", object: "price" });
  if (req.method === "GET" && req.url.startsWith("/api/v1/catalog")) return json(200, {
    plans: [{ id: "old", key: "payg", name: "Pay as you go", planGroup: "default", billingInterval: "month", intervalCount: 1, priceAmountCents: 0, currency: "usd", trialDays: 0, autoSubscribe: false },
      { id: "new", key: "pro", name: "Pro", planGroup: "default", billingInterval: "month", intervalCount: 1, priceAmountCents: 1500, currency: "usd", trialDays: 0, autoSubscribe: false }], topups: [],
  });
  if (req.method === "GET" && req.url.startsWith("/api/v1/entitlements")) return json(200, {
    user: { id: "local", rxlabUserId: "local-development-user" },
    plans: [{ subscriptionId: "local", planId: "old", planKey: "payg", planName: "Pay as you go", planGroup: "default", status: "active", billingProvider: "stripe", cancelAtPeriodEnd: false }],
    defaultPlans: [], complimentaryPlans: [], balances: [], usage: [], roles: [], permissions: [],
  });
  const data = fields(req.body);
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
    return json(200, { url: "https://billing.stripe.com/p/session/simulated" });
  }
  return json(501, { error: "not_modeled" });
}).listen(process.env.PORT);
