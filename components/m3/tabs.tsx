"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./cn";

/** M3 primary tabs that navigate between pages; the active tab follows the URL. */
export function LinkTabs({ tabs, label }: { tabs: { href: string; label: string; count?: number }[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex border-b border-outline-variant">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn("state-layer relative flex h-12 min-w-24 items-center justify-center gap-2 px-4 type-title-small", active ? "text-primary" : "text-on-surface-variant")}
          >
            {tab.label}
            {tab.count !== undefined ? <span className="type-label-medium tabular-nums opacity-80">{tab.count}</span> : null}
            {active ? <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-primary" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
