"use client";

import { usePathname } from "next/navigation";

/** Remounts on every top-level dashboard navigation, so each page enters with the M3 shared-axis motion. */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  // The agent animates its own panes in (see chat/layout.tsx).
  const animate = !usePathname().startsWith("/chat");
  return <div className={animate ? "animate-page-in" : undefined}>{children}</div>;
}
