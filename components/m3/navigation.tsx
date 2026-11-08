"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip } from "radix-ui";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";
import { IconButton } from "./button";
import { cn } from "./cn";

export type NavItem = { href: string; label: string; icon: ReactNode; divider?: boolean };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Expanded desktop navigation, with a compact icon rail on medium windows. */
export function NavigationRail({ items, header, footer }: { items: NavItem[]; header?: ReactNode; footer?: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  return (
    <nav aria-label={t("Main")} className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col bg-surface px-3 py-5 md:flex lg:w-60 lg:px-4">
      <div className="flex h-12 shrink-0 items-center justify-center lg:justify-start">{header}</div>
      <ul className="mt-6 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain py-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className={cn(item.divider && "mt-4 border-t border-outline-variant/40 pt-4")}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "state-layer relative flex h-11 items-center justify-center gap-3 rounded-md px-3 type-label-large transition-colors duration-200 ease-emphasized lg:justify-start",
                      active ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant hover:text-on-surface",
                    )}
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center [&>svg]:size-5" aria-hidden>{item.icon}</span>
                    <span className="hidden min-w-0 truncate lg:block">{item.label}</span>
                    {active && <span aria-hidden className="absolute right-3 hidden size-1.5 rounded-full bg-primary lg:block" />}
                  </Link>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content side="right" sideOffset={12} className="z-50 rounded-sm bg-inverse-surface px-3 py-2 type-label-medium text-inverse-on-surface shadow-elevation-1 lg:hidden">
                    {item.label}
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 shrink-0 border-t border-outline-variant/40 pt-4">{footer}</div>
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-1 bg-surface px-2 md:hidden">
        <IconButton label={t("Open navigation")} onClick={() => setOpen(true)} aria-expanded={open} aria-haspopup="dialog">
          <Menu size={24} />
        </IconButton>
        <div className="flex min-w-0 flex-1 items-center">{header}</div>
        {actions ? <div className="flex shrink-0 items-center gap-1 pr-1">{actions}</div> : null}
      </header>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(20rem,calc(100vw-3.5rem))] max-w-none overflow-hidden rounded-r-xl border-0 bg-surface-container-low p-0 text-on-surface shadow-elevation-2 backdrop:bg-scrim/40 backdrop:animate-fade-in animate-drawer-in"
      >
        <div className="flex h-full flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex h-14 shrink-0 items-center justify-between gap-3">
            <span id={titleId} className="sr-only">{t("Main")}</span>
            {header}
            <IconButton label={t("Close navigation")} onClick={() => setOpen(false)}>
              <X size={24} />
            </IconButton>
          </div>
          <nav aria-label={t("Main")} className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
            <ul className="space-y-1">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href} className={cn(item.divider && "mt-4 border-t border-outline-variant/40 pt-4")}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "state-layer flex h-12 items-center gap-3 rounded-md px-4 type-label-large transition-colors duration-200 ease-emphasized",
                        active ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant",
                      )}
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center [&>svg]:size-5" aria-hidden>{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </dialog>
    </>
  );
}
