"use client";

import { useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/m3/button";
import { useT } from "@/lib/i18n/client";
import { startPlanChange } from "./actions";

export function PlanChangeDialog({ productId, currentName, targetName, targetPrice, downgrade, periodEnd }: {
  productId: string; currentName: string; targetName: string; targetPrice: string; downgrade: boolean; periodEnd: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useT();
  const baseTiming: "immediate" | "next_period" = downgrade || params.get("timing") === "next_period" ? "next_period" : "immediate";
  const [timing, setOptimisticTiming] = useOptimistic(baseTiming);
  function changeTiming(value: "immediate" | "next_period") {
    const next = new URLSearchParams(params);
    next.set("timing", value);
    startSelection(() => { setOptimisticTiming(value); router.replace(`${pathname}?${next}`, { scroll: false }); });
  }
  const [pending, startTransition] = useTransition();
  const [selecting, startSelection] = useTransition();
  const busy = pending || selecting;
  const [status, setStatus] = useState<{ message: string; error?: boolean } | null>(null);
  function dismiss() {
    if (busy) return;
    const next = new URLSearchParams(params);
    next.delete("changePlan");
    next.delete("timing");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onClick={(event) => { if (event.target === event.currentTarget) {
        const box = event.currentTarget.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dismiss();
      } }}
      className="fixed inset-0 m-auto max-h-[90vh] w-[min(480px,calc(100vw-32px))] overflow-y-auto rounded-xl bg-surface-container-high p-6 text-on-surface shadow-elevation-3 backdrop:bg-scrim/40 backdrop:animate-fade-in open:animate-fade-in"
    >
      {status ? <div role={status.error ? "alert" : "status"} className="absolute inset-x-4 top-4 z-10 flex items-center gap-3 rounded-xs bg-inverse-surface p-4 text-inverse-on-surface shadow-elevation-3 animate-snackbar-in">
        <span className="flex-1 type-body-medium">{status.message}</span>
        {!pending ? <Button variant="text" onClick={() => setStatus(null)}>{t("Dismiss")}</Button> : null}
      </div> : null}
      <h2 id={titleId} className="type-headline-small">{t("Change plan")}</h2>
      <p className="mt-4 type-title-medium">{t("From {plan}", { plan: currentName })}</p>
      <p className="mt-2 type-title-medium">{t("To {plan}", { plan: targetName })}</p>
      <p className="mt-2 type-body-large">{targetPrice}</p>
      <fieldset className="mt-4 flex flex-col gap-3" disabled={busy}>
        <legend className="mb-2 type-title-small">{t("When should this change start?")}</legend>
        {!downgrade ? <label className="flex items-center gap-3 type-body-medium"><input type="radio" name="timing" value="immediate" checked={timing === "immediate"} onChange={() => changeTiming("immediate")} />{t("Immediately, with prorated billing")}</label> : null}
        <label className="flex items-center gap-3 type-body-medium"><input type="radio" name="timing" value="next_period" disabled={!periodEnd} checked={timing === "next_period"} onChange={() => changeTiming("next_period")} />{t("At the next billing period")}{periodEnd ? ` · ${formatDateTime(periodEnd, t.locale)}` : ""}</label>
      </fieldset>
      <p id={descriptionId} className="mt-4 type-body-medium text-on-surface-variant">
        {timing === "next_period" ? t("Keep your current plan until renewal. Save a payment method with Stripe now; the new plan starts and is billed at the next period. Opening the review does not schedule a change.") : t("Review prorated charges and confirm your change securely with Stripe. Opening the review does not change your plan. Access updates after Stripe confirms the change.")}
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="text" disabled={busy} onClick={dismiss}>{t("Cancel")}</Button>
        <Button disabled={busy || (timing === "next_period" && !periodEnd)} onClick={() => startTransition(async () => {
          setStatus({ message: t("Opening plan review…") });
          try {
            const result = await startPlanChange({ productId, timing });
            if (!result.ok) { setStatus({ message: result.error, error: true }); return; }
            setStatus({ message: t("Redirecting to plan review") });
            window.location.assign(result.data.url);
          } catch {
            setStatus({ message: t("Something went wrong. Please try again."), error: true });
          }
        })}>{t("Review with Stripe")}</Button>
      </div>
    </dialog>
  );
}
