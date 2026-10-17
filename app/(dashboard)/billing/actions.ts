"use server";

import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { requireActionUser } from "@/lib/auth";
import { createBillingPortalSession, createCheckout } from "@/lib/billing/subscription";
import { siteUrl } from "@/lib/site";

export async function startCheckout(input: { kind: "plan" | "topup"; productId: string }) {
  return runAction(async () => {
    const user = await requireActionUser();
    const data = z.object({ kind: z.enum(["plan", "topup"]), productId: z.string().min(1) }).parse(input);
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

export async function openBillingPortal() {
  return runAction(async () => {
    const user = await requireActionUser();
    const session = await createBillingPortalSession({ user, returnUrl: `${await siteUrl()}/billing` });
    return { url: session.url };
  });
}
