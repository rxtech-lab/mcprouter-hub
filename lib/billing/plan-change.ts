import type { CatalogPlan, Entitlements } from "./subscription";

/** Automatic defaults can be replaced by checkout; owned plans need a change. */
export function planPurchaseMode(target: CatalogPlan, entitlements: Entitlements) {
  const all = [...entitlements.plans, ...entitlements.complimentaryPlans, ...entitlements.defaultPlans];
  if (all.some((plan) => plan.planId === target.id)) return { kind: "current" } as const;
  if (target.autoSubscribe) return { kind: "automatic" } as const;
  const owned = [...entitlements.plans, ...entitlements.complimentaryPlans].find(
    (plan) => (plan.planGroup ?? "default") === (target.planGroup ?? "default"),
  );
  if (!owned) return { kind: "checkout" } as const;
  if (owned.billingProvider !== "stripe" || !owned.subscriptionId ||
      !["active", "trialing"].includes(owned.status) || owned.cancelAtPeriodEnd ||
      target.billingInterval === "one_time") return { kind: "unsupported" } as const;
  return { kind: "change", current: owned } as const;
}
