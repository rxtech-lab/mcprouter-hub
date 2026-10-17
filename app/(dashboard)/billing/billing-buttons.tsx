"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/m3/button";
import { useSnackbar } from "@/components/m3/snackbar";
import { useActionRunner } from "@/components/use-action-runner";
import { openBillingPortal, startCheckout } from "./actions";

export function ProductButton({ kind, productId, label, current, disabled }: { kind: "plan" | "topup"; productId: string; label: string; current?: boolean; disabled?: boolean }) {
  const { pending, run } = useActionRunner();
  if (current) return <Button variant="tonal" disabled>Current plan</Button>;
  return (
    <Button
      disabled={pending || disabled}
      onClick={() => run(() => startCheckout({ kind, productId }), { progress: "Opening checkout…", success: "Redirecting to checkout" }, (data) => window.location.assign(data.url))}
    >
      {pending ? "Opening…" : label}
    </Button>
  );
}

export function PortalButton() {
  const { pending, run } = useActionRunner();
  return (
    <Button
      variant="outlined"
      icon={<ExternalLink size={16} />}
      disabled={pending}
      onClick={() => run(openBillingPortal, { progress: "Opening billing portal…", success: "Redirecting to the billing portal" }, (data) => window.location.assign(data.url))}
    >
      Invoices &amp; payment
    </Button>
  );
}

/** Shows the checkout result once when Stripe sends the user back. */
export function CheckoutNotice({ status }: { status?: string }) {
  const snackbar = useSnackbar();
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current || !status) return;
    shown.current = true;
    if (status === "success") snackbar.show("Payment complete. Your plan will update in a moment.", { tone: "success" });
    if (status === "cancelled") snackbar.show("Checkout cancelled. Nothing was charged.");
  }, [status, snackbar]);
  return null;
}
