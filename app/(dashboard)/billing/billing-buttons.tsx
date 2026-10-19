"use client";

import { trackEvent } from "@/lib/analytics";
import { ExternalLink } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/m3/button";
import { useSnackbar } from "@/components/m3/snackbar";
import { useActionRunner } from "@/components/use-action-runner";
import { useT } from "@/lib/i18n/client";
import { openBillingPortal, startCheckout } from "./actions";

export function ProductButton({ kind, productId, label, current, disabled }: { kind: "plan" | "topup"; productId: string; label: string; current?: boolean; disabled?: boolean }) {
  const { pending, run } = useActionRunner();
  const t = useT();
  if (current) return <Button variant="tonal" disabled>{t("Current plan")}</Button>;
  return (
    <Button
      disabled={pending || disabled}
      onClick={() => run(() => startCheckout({ kind, productId }), { progress: t("Opening checkout…"), success: t("Redirecting to checkout") }, (data) => { trackEvent("begin_checkout", { product_kind: kind, product_id: productId }); window.location.assign(data.url); })}
    >
      {pending ? t("Opening…") : label}
    </Button>
  );
}

export function PortalButton() {
  const { pending, run } = useActionRunner();
  const t = useT();
  return (
    <Button
      variant="outlined"
      icon={<ExternalLink size={16} />}
      disabled={pending}
      onClick={() => run(openBillingPortal, { progress: t("Opening billing portal…"), success: t("Redirecting to the billing portal") }, (data) => window.location.assign(data.url))}
    >
      {t("Invoices & payment")}
    </Button>
  );
}

/** Shows the checkout result once when Stripe sends the user back. */
export function CheckoutNotice({ status }: { status?: string }) {
  const snackbar = useSnackbar();
  const t = useT();
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current || !status) return;
    shown.current = true;
    if (status === "success") snackbar.show(t("Payment complete. Your plan will update in a moment."), { tone: "success" });
    if (status === "cancelled") snackbar.show(t("Checkout cancelled. Nothing was charged."));
  }, [status, snackbar, t]);
  return null;
}
