"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "./cn";

export type NavItem = { href: string; label: string; icon: ReactNode };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** M3 navigation rail for medium and larger windows. */
export function NavigationRail({ items, header, footer }: { items: NavItem[]; header?: ReactNode; footer?: ReactNode }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col items-center gap-3 bg-surface py-4 md:flex">
      {header}
      <ul className="mt-4 flex flex-col gap-3">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className="group flex w-20 flex-col items-center gap-1">
                <span
                  className={cn(
                    "state-layer flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    active ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant",
                  )}
                >
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

/** M3 navigation bar for compact windows. */
export function NavigationBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex h-20 items-stretch overflow-x-auto bg-surface-container md:hidden">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="flex min-w-16 flex-1 flex-col items-center justify-center gap-1"
          >
            <span className={cn("flex h-8 w-14 items-center justify-center rounded-full", active ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant")}>
              {item.icon}
            </span>
            <span className={cn("type-label-small", active ? "text-on-surface" : "text-on-surface-variant")}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
