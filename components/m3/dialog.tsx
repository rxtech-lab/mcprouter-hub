"use client";

import { Dialog as RadixDialog, AlertDialog } from "radix-ui";
import type { ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";

const overlay = "fixed inset-0 z-40 bg-scrim/40 animate-fade-in";
// Centred by a flex wrapper rather than translate(-50%), so the entry transition can't knock it off-centre.
const center = "fixed inset-0 z-50 flex items-center justify-center";
const surface =
  "flex max-h-[90vh] w-[min(560px,calc(100vw-32px))] flex-col gap-4 overflow-hidden rounded-xl bg-surface-container-high p-6 text-on-surface shadow-elevation-3 transition-[opacity,translate,scale] duration-250 ease-[cubic-bezier(0.05,0.7,0.1,1)] starting:translate-y-2 starting:scale-96 starting:opacity-0";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** When false, clicking outside or pressing Escape does not close it (e.g. a key shown once). */
  dismissible?: boolean;
};

/** M3 basic dialog: headline, supporting text, content and actions on the right. */
export function Dialog({ open, onOpenChange, title, description, icon, children, actions, className, dismissible = true }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={overlay} />
        <div className={center}>
          <RadixDialog.Content
            className={cn(surface, className)}
            onInteractOutside={dismissible ? undefined : (event) => event.preventDefault()}
            onEscapeKeyDown={dismissible ? undefined : (event) => event.preventDefault()}
          >
            {icon ? <div className="flex justify-center text-secondary">{icon}</div> : null}
            <RadixDialog.Title className={cn("type-headline-small", icon ? "text-center" : undefined)}>{title}</RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="type-body-medium text-on-surface-variant">{description}</RadixDialog.Description>
            ) : (
              <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
            )}
            {children ? <div className="-mx-6 min-h-0 overflow-y-auto px-6">{children}</div> : null}
            {actions ? <div className="flex flex-wrap justify-end gap-2 pt-2">{actions}</div> : null}
          </RadixDialog.Content>
        </div>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
};

/** M3 confirmation dialog, built on Radix AlertDialog so it can't be dismissed by clicking outside. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, destructive, pending, onConfirm }: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlay} />
        <div className={center}>
          <AlertDialog.Content className={cn(surface, "w-[min(400px,calc(100vw-32px))]")}>
            <AlertDialog.Title className="type-headline-small">{title}</AlertDialog.Title>
            <AlertDialog.Description className="type-body-medium text-on-surface-variant">{description}</AlertDialog.Description>
            <div className="flex justify-end gap-2 pt-2">
              <AlertDialog.Cancel asChild>
                <Button variant="text" disabled={pending}>Cancel</Button>
              </AlertDialog.Cancel>
              <Button
                variant={destructive ? "danger" : "filled"}
                disabled={pending}
                onClick={(event) => {
                  event.preventDefault();
                  onConfirm();
                }}
              >
                {pending ? "Working…" : confirmLabel}
              </Button>
            </div>
          </AlertDialog.Content>
        </div>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
