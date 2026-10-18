"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./cn";

/** M3 primary tabs that navigate between pages; the active tab follows the URL. A `nested` tab stays active on its sub-pages. */
export function LinkTabs({ tabs, label }: { tabs: { href: string; label: string; count?: number; nested?: boolean }[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex border-b border-outline-variant">
      {tabs.map((tab) => {
        const active = pathname === tab.href || (!!tab.nested && pathname.startsWith(`${tab.href}/`));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn("state-layer relative flex h-12 min-w-24 items-center justify-center gap-2 px-4 type-title-small transition-colors duration-200", active ? "text-primary" : "text-on-surface-variant")}
          >
            {tab.label}
            {tab.count !== undefined ? <span className="type-label-medium tabular-nums opacity-80">{tab.count}</span> : null}
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-3 bottom-0 h-[3px] origin-center rounded-t-full bg-primary transition-[scale,opacity] duration-300 ease-emphasized",
                active ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
