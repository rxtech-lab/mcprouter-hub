import { describe, expect, it } from "vitest";
import { planPurchaseMode } from "@/lib/billing/plan-change";
import type { CatalogPlan, Entitlements, ResolvedPlan } from "@/lib/billing/subscription";

const target = { id: "pro", planGroup: "default", billingInterval: "month", autoSubscribe: false } as CatalogPlan;
const owned = { subscriptionId: "sub-local", planId: "payg", planGroup: "default", billingProvider: "stripe", status: "active", cancelAtPeriodEnd: false } as ResolvedPlan;
const entitlements = (overrides: Partial<Entitlements> = {}) => ({ plans: [], complimentaryPlans: [], defaultPlans: [], ...overrides }) as Entitlements;

describe("plan purchase routing", () => {
  it("offers timing selection for automatic free defaults", () => {
    expect(planPurchaseMode(target, entitlements({ defaultPlans: [{ ...owned, billingProvider: "internal" }] })).kind).toBe("change");
  });
  it("offers a change for a Stripe plan in the same group", () => {
    expect(planPurchaseMode(target, entitlements({ plans: [owned] }))).toEqual({ kind: "change", current: owned });
  });
  it("allows checkout in another group", () => {
    expect(planPurchaseMode({ ...target, planGroup: "extras" }, entitlements({ plans: [owned] })).kind).toBe("checkout");
  });
  it("marks an owned plan as current", () => {
    expect(planPurchaseMode(target, entitlements({ plans: [{ ...owned, planId: target.id }] })).kind).toBe("current");
  });
  it.each([
    { billingProvider: "apple_app_store" }, { billingProvider: "complimentary" },
    { subscriptionId: null }, { status: "past_due" }, { cancelAtPeriodEnd: true },
  ])("blocks unsupported subscriptions: %j", (override) => {
    expect(planPurchaseMode(target, entitlements({ plans: [{ ...owned, ...override }] })).kind).toBe("unsupported");
  });
  it("never checks out an automatic plan or changes to a one-time purchase", () => {
    expect(planPurchaseMode({ ...target, autoSubscribe: true }, entitlements()).kind).toBe("automatic");
    expect(planPurchaseMode({ ...target, billingInterval: "one_time" }, entitlements({ plans: [owned] })).kind).toBe("unsupported");
  });
});


describe("downgrade to automatic Free", () => {
  it("opens a plan change for an owned Stripe subscription", () => {
    expect(planPurchaseMode({ ...target, autoSubscribe: true, priceAmountCents: 0 }, entitlements({ plans: [owned] }))).toEqual({ kind: "change", current: owned });
  });
  it("does not purchase Free when no subscription exists", () => {
    expect(planPurchaseMode({ ...target, autoSubscribe: true }, entitlements()).kind).toBe("automatic");
  });
});
