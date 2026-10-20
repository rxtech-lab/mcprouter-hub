"use client";

import { useId, useRef, useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import type { UserInputRequest } from "@/lib/agent/user-input";
import { useT } from "@/lib/i18n/client";
import { Markdown } from "./markdown";

/** A dedicated answer view. Opening it is deliberate, so streaming never steals focus. */
export function UserInputCard({ request, disabled, onAnswer }: { request: UserInputRequest; disabled: boolean; onAnswer?: (answer: string) => void }) {
  const t = useT();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [answer, setAnswer] = useState("");
  const [sent, setSent] = useState(false);
  const locked = disabled || sent || !onAnswer;
  return (
    <section className="my-3 rounded-lg border border-outline-variant bg-surface-container-low p-4 animate-message-in" data-testid="user-input-request">
      <div className="mb-2 flex items-center gap-2 type-label-large text-primary"><MessageCircleQuestion size={18} />{t("Your input is needed")}</div>
      <div className="type-body-large"><Markdown>{request.question}</Markdown></div>
      <button type="button" disabled={locked} onClick={() => dialog.current?.showModal()} className="state-layer mt-3 min-h-10 rounded-full bg-primary px-5 type-label-large text-on-primary disabled:opacity-40">
        {sent ? t("Answer sent") : locked ? t("Previous question") : t("Answer question")}
      </button>
      <dialog ref={dialog} aria-labelledby={`${id}-title`} className="fixed inset-0 m-auto max-h-[85dvh] w-[min(480px,calc(100vw-32px))] overflow-y-auto rounded-xl bg-surface-container-high p-6 text-on-surface shadow-elevation-3 backdrop:bg-scrim/40 open:animate-message-in">
        <form onSubmit={(event) => {
          event.preventDefault();
          if (locked || !answer.trim()) return;
          setSent(true);
          dialog.current?.close();
          onAnswer?.(answer.trim());
        }}>
          <h2 id={`${id}-title`} className="type-title-large">{request.question}</h2>
          {request.options.length ? (
            <fieldset disabled={locked} className="mt-4 flex flex-col gap-2">
              <legend className="sr-only">{t("Choose an option")}</legend>
              {request.options.map((option, index) => (
                <label key={index} className="state-layer flex cursor-pointer items-start gap-3 rounded-md border border-outline-variant p-3 has-checked:border-primary has-checked:bg-primary-container has-checked:text-on-primary-container transition-colors duration-200">
                  <input type="radio" name={id} checked={answer === option.label} onChange={() => setAnswer(option.label)} className="mt-1 accent-[var(--md-sys-color-primary)]" />
                  <span><span className="block type-label-large">{option.label}</span>{option.description ? <span className="mt-1 block type-body-small">{option.description}</span> : null}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
          <label className="mt-4 block type-label-large" htmlFor={`${id}-answer`}>{request.options.length ? t("Or enter your own answer") : t("Your answer")}</label>
          <input id={`${id}-answer`} value={answer} maxLength={2000} disabled={locked} onChange={(event) => setAnswer(event.target.value)} className="mt-2 min-h-12 w-full rounded-sm border border-outline bg-surface px-3 type-body-large focus:outline-2 focus:outline-primary" />
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => dialog.current?.close()} className="state-layer min-h-10 rounded-full px-4 type-label-large text-primary">{t("Cancel")}</button>
            <button type="submit" disabled={locked || !answer.trim()} className="state-layer min-h-10 rounded-full bg-primary px-5 type-label-large text-on-primary disabled:opacity-40">{t("Send answer")}</button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
