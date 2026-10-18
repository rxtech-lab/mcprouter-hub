"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";
import { IconButton } from "./button";
import { cn } from "./cn";

export type NavItem = { href: string; label: string; icon: ReactNode };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Active indicator pill that expands from the centre when its destination is selected. */
function Indicator({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-0 -z-10 rounded-full bg-secondary-container transition-[scale,opacity] duration-300 ease-emphasized",
        active ? "scale-x-100 opacity-100" : "scale-x-30 opacity-0",
      )}
    />
  );
}

/** M3 navigation rail for medium and larger windows. */
export function NavigationRail({ items, header, footer }: { items: NavItem[]; header?: ReactNode; footer?: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  return (
    <nav aria-label={t("Main")} className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col items-center gap-3 bg-surface py-4 md:flex">
      {header}
      <ul className="mt-4 flex flex-col gap-3">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className="group flex w-20 flex-col items-center gap-1">
                <span
                  className={cn(
                    "state-layer relative flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200",
                    active ? "text-on-secondary-container" : "text-on-surface-variant",
                  )}
                >
                  <Indicator active={active} />
                  {item.icon}
                </span>
                <span className={cn("type-label-medium", active ? "text-on-surface" : "text-on-surface-variant")}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto">{footer}</div>
    </nav>
  );
}

/**
 * M3 top app bar with a modal navigation drawer for compact windows. The menu button slides the
 * destinations in from the leading edge; picking one closes the drawer.
 */
export function NavigationDrawer({ items, header, actions }: { items: NavItem[]; header?: ReactNode; actions?: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-1 bg-surface px-2 md:hidden">
        <Dialog.Trigger asChild>
          <IconButton label={t("Open navigation")}>
            <Menu size={24} />
          </IconButton>
        </Dialog.Trigger>
        <div className="flex min-w-0 flex-1 items-center">{header}</div>
        {actions ? <div className="flex shrink-0 items-center gap-1 pr-1">{actions}</div> : null}
      </header>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim/40 animate-fade-in data-[state=closed]:animate-fade-out md:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-[min(22.5rem,calc(100vw-3.5rem))] animate-drawer-in flex-col rounded-r-lg bg-surface-container-low px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] text-on-surface shadow-elevation-1 data-[state=closed]:animate-drawer-out md:hidden"
        >
          <div className="flex h-14 items-center gap-1">
            <Dialog.Close asChild>
              <IconButton label={t("Close navigation")}>
                <X size={24} />
              </IconButton>
            </Dialog.Close>
            <Dialog.Title className="sr-only">{t("Main")}</Dialog.Title>
            {header}
          </div>
          <nav aria-label={t("Main")} className="min-h-0 flex-1 overflow-y-auto py-2">
            <ul className="flex flex-col">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "state-layer flex h-14 items-center gap-3 rounded-full px-4 type-label-large transition-colors duration-200",
                        active ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant",
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
