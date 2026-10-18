"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "./cn";

type Tone = "info" | "success" | "error" | "progress";
type Snack = { id: number; message: string; tone: Tone; action?: { label: string; onClick: () => void } };
type ShowOptions = { tone?: Tone; action?: Snack["action"]; duration?: number };

type SnackbarApi = {
  show: (message: string, options?: ShowOptions) => number;
  dismiss: (id?: number) => void;
};

const SnackbarContext = createContext<SnackbarApi | null>(null);

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (!context) throw new Error("useSnackbar must be used inside <SnackbarProvider>");
  return context;
}

/**
 * Status overlay for every action outside a plain list: progress while a
 * write is running, then success or failure. One snackbar at a time, as M3
 * prescribes; a new message replaces the current one.
 */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [snack, setSnack] = useState<Snack | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const dismiss = useCallback((id?: number) => {
    setSnack((current) => (id === undefined || current?.id === id ? null : current));
  }, []);

  const show = useCallback((message: string, options: ShowOptions = {}) => {
    const id = ++counter.current;
    const tone = options.tone ?? "info";
    setSnack({ id, message, tone, action: options.action });
    if (timer.current) clearTimeout(timer.current);
    if (tone !== "progress") {
      timer.current = setTimeout(() => dismiss(id), options.duration ?? (tone === "error" ? 6000 : 4000));
    }
    if (tone === "success" || tone === "error") navigator.vibrate?.(tone === "error" ? [30, 40, 30] : 15);
    return id;
  }, [dismiss]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <SnackbarContext.Provider value={{ show, dismiss }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 md:bottom-6">
        {snack ? (
          <div
            key={snack.id}
            role={snack.tone === "error" ? "alert" : "status"}
            data-testid="snackbar"
            className={cn(
              "pointer-events-auto flex min-h-12 w-full max-w-xl items-center gap-3 rounded-xs bg-inverse-surface py-2 pr-2 pl-4 text-inverse-on-surface shadow-elevation-3 animate-snackbar-in",
            )}
          >
            {snack.tone === "progress" ? <LoaderCircle size={18} className="animate-spin" /> : null}
            {snack.tone === "success" ? <CircleCheck size={18} /> : null}
            {snack.tone === "error" ? <CircleAlert size={18} /> : null}
            <span className="flex-1 type-body-medium">{snack.message}</span>
            {snack.action ? (
              <button
                type="button"
                className="state-layer h-9 cursor-pointer rounded-full px-3 type-label-large text-inverse-primary"
                onClick={() => {
                  snack.action?.onClick();
                  dismiss(snack.id);
                }}
              >
                {snack.action.label}
              </button>
            ) : null}
            {snack.tone !== "progress" ? (
              <button type="button" aria-label={t("Dismiss")}
 className="state-layer inline-flex size-9 cursor-pointer items-center justify-center rounded-full" onClick={() => dismiss(snack.id)}>
                <X size={18} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </SnackbarContext.Provider>
  );
}
