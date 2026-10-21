"use server";

import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { requireActionUser } from "@/lib/auth";
import { createBillingPortalSession, createCheckout, createPlanChangeSession, getCatalog, getEntitlements, SubscriptionApiError } from "@/lib/billing/subscription";
import { planPurchaseMode } from "@/lib/billing/plan-change";
import { getT } from "@/lib/i18n/server";
import { siteUrl } from "@/lib/site";

async function runBillingAction<T>(body: () => Promise<T>) {
  let refused = false;
  const result = await runAction(async () => {
    try { return await body(); }
    catch (error) {
      refused = error instanceof SubscriptionApiError && [400, 403, 409].includes(error.status) ||
        error instanceof Error && error.message === "PLAN_CHANGE_UNAVAILABLE";
      throw error;
    }
  });
  if (!result.ok && refused) {
    const t = await getT();
    return { ok: false as const, error: t("This plan change is unavailable. Refresh billing, or manage your subscription with its billing provider.") };
  }
  return result;
}

export async function startCheckout(input: { kind: "plan" | "topup"; productId: string }) {
  return runAction(async () => {
    const user = await requireActionUser();
    const data = z.object({ kind: z.enum(["plan", "topup"]), productId: z.string().min(1) }).parse(input);
    if (data.kind === "plan") {
      const [catalog, entitlements] = await Promise.all([getCatalog(user), getEntitlements(user)]);
      const plan = catalog.plans.find((candidate) => candidate.id === data.productId);
      if (!plan || planPurchaseMode(plan, entitlements).kind !== "checkout") {
        throw new Error("PLAN_CHANGE_UNAVAILABLE");
      }
    }
    const origin = await siteUrl();
    const session = await createCheckout({
      user,
      kind: data.kind,
      productId: data.productId,
      successUrl: `${origin}/billing?checkout=success`,
      cancelUrl: `${origin}/billing?checkout=cancelled`,
    });
    return { url: session.checkoutUrl };
  });
}

export async function startPlanChange(input: { productId: string }) {
  return runBillingAction(async () => {
    const user = await requireActionUser();
    const data = z.object({ productId: z.string().min(1) }).parse(input);
    const [catalog, entitlements] = await Promise.all([getCatalog(user), getEntitlements(user)]);
    const plan = catalog.plans.find((candidate) => candidate.id === data.productId);
    const mode = plan && planPurchaseMode(plan, entitlements);
    if (!plan || !mode || mode.kind !== "change") throw new Error("PLAN_CHANGE_UNAVAILABLE");
    return createPlanChangeSession({ user, subscriptionId: mode.current.subscriptionId!,
      planId: plan.id, returnUrl: `${await siteUrl()}/billing?checkout=changed` });
  });
}

export async function openBillingPortal() {
  return runAction(async () => {
    const user = await requireActionUser();
    const session = await createBillingPortalSession({ user, returnUrl: `${await siteUrl()}/billing` });
    return { url: session.url };
  });
}
