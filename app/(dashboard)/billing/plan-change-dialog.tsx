"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/m3/button";
import { useT } from "@/lib/i18n/client";
import { startPlanChange } from "./actions";

export function PlanChangeDialog({ productId, currentName, targetName, targetPrice }: {
  productId: string; currentName: string; targetName: string; targetPrice: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ message: string; error?: boolean } | null>(null);
  function dismiss() {
    if (pending) return;
    const next = new URLSearchParams(params);
    next.delete("changePlan");
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
      <p id={descriptionId} className="mt-4 type-body-medium text-on-surface-variant">
        {t("Review prorated charges and confirm your change securely with Stripe. Opening the review does not change your plan. Access updates after Stripe confirms the change.")}
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="text" disabled={pending} onClick={dismiss}>{t("Cancel")}</Button>
        <Button disabled={pending} onClick={() => startTransition(async () => {
          setStatus({ message: t("Opening plan review…") });
          try {
            const result = await startPlanChange({ productId });
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
