"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** Native modal focus containment, Escape and backdrop; controlled by the URL. */
export function NativeDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog aria-labelledby={titleId} ref={ref} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }} className="fixed inset-0 m-auto max-h-[90dvh] w-[min(640px,calc(100vw-32px))] overflow-y-auto rounded-xl bg-surface-container-high p-6 text-on-surface shadow-elevation-3 backdrop:bg-scrim/40 animate-pane-in">
    <h2 id={titleId} className="type-headline-small mb-6">{title}</h2>
    {children}
  </dialog>;
}
