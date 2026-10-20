"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, MapPin } from "lucide-react";
import { locationAnswer } from "@/lib/agent/location";
import { useT } from "@/lib/i18n/client";

export function UserLocationCard({ reason, disabled, onAnswer }: { reason: string; disabled: boolean; onAnswer?: (answer: string) => void }) {
  const t = useT();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const attempt = useRef(0);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const locked = disabled || sent || !onAnswer;
  const active = useRef(!locked);
  useEffect(() => {
    const attempts = attempt;
    active.current = !locked;
    if (locked) {
      attempts.current++;
      dialog.current?.close();
    }
    return () => { active.current = false; attempts.current++; };
  }, [locked]);

  function finish(answer: string) {
    if (!active.current) return;
    attempt.current++;
    active.current = false;
    setSent(true);
    setBusy(false);
    dialog.current?.close();
    onAnswer?.(answer);
  }

  function share() {
    if (locked || busy) return;
    setError("");
    if (!window.isSecureContext || !navigator.geolocation) {
      setError(t("Location is unavailable in this browser. Enter a place in chat instead."));
      return;
    }
    setBusy(true);
    const current = ++attempt.current;
    navigator.geolocation.getCurrentPosition((position) => {
      if (current !== attempt.current || !active.current) return;
      try { finish(locationAnswer(position)); }
      catch { setBusy(false); setError(t("Could not get your location. Try again or enter a place in chat.")); }
    }, (failure) => {
      if (current !== attempt.current || !active.current) return;
      setBusy(false);
      setError(failure.code === 1
        ? t("Location permission was denied. Enter a place in chat instead.")
        : t("Could not get your location. Try again or enter a place in chat."));
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });
  }

  return (
    <section className="my-3 rounded-lg border border-outline-variant bg-surface-container-low p-4 animate-message-in" data-testid="user-location-request">
      <div className="mb-2 flex items-center gap-2 type-label-large text-primary"><MapPin size={18} />{t("Use your location?")}</div>
      <p className="type-body-large">{reason}</p>
      <button type="button" disabled={locked} onClick={() => dialog.current?.showModal()} className="state-layer mt-3 min-h-10 rounded-full bg-primary px-5 type-label-large text-on-primary disabled:opacity-40">
        {sent ? t("Answer sent") : locked ? t("Previous question") : t("Review location request")}
      </button>
      <dialog ref={dialog} aria-labelledby={`${id}-title`} onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} onCancel={(event) => { event.stopPropagation(); attempt.current++; setBusy(false); }} className="fixed inset-0 m-auto max-h-[85dvh] w-[min(480px,calc(100vw-32px))] overflow-y-auto rounded-xl bg-surface-container-high p-6 text-on-surface shadow-elevation-3 backdrop:bg-scrim/40 open:animate-message-in">
        <h2 id={`${id}-title`} className="type-title-large">{t("Use your location?")}</h2>
        <p className="mt-4 type-body-large">{reason}</p>
        <p className="mt-3 type-body-medium text-on-surface-variant">{t("Sharing sends your coordinates and accuracy to this chat and the tools used to answer. Your browser may ask for permission. You can enter a place instead.")}</p>
        {error ? <p role="alert" className="mt-4 rounded-md bg-error-container p-3 type-body-medium text-on-error-container">{error}</p> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" disabled={locked || busy} onClick={() => finish(t("I prefer not to share my device location. Please ask me for a place instead."))} className="state-layer min-h-10 rounded-full px-4 type-label-large text-primary disabled:opacity-40">{t("Enter a place instead")}</button>
          <button type="button" disabled={locked || busy} onClick={share} className="state-layer min-h-10 rounded-full bg-primary px-5 type-label-large text-on-primary disabled:opacity-40">{t("Share location")}</button>
        </div>
        {busy ? <div role="status" className="absolute inset-0 flex items-center justify-center gap-3 rounded-xl bg-surface-container-high/95 p-6"><LoaderCircle className="animate-spin text-primary" size={24} />{t("Getting your location…")}</div> : null}
      </dialog>
    </section>
  );
}
