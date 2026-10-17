"use client";

import { BarChart3, Blocks, CreditCard, KeyRound, LayoutDashboard, MessageSquareText, Radar } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip } from "radix-ui";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { cn } from "@/components/m3/cn";
import { NavigationBar, NavigationRail, type NavItem } from "@/components/m3/navigation";
import { SnackbarProvider } from "@/components/m3/snackbar";

const items: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: <LayoutDashboard size={22} /> },
  { href: "/keys", label: "API keys", icon: <KeyRound size={22} /> },
  { href: "/usage", label: "Usage", icon: <BarChart3 size={22} /> },
  { href: "/services", label: "Services", icon: <Blocks size={22} /> },
  { href: "/tracker", label: "Tracker", icon: <Radar size={22} /> },
  { href: "/chat", label: "Agent", icon: <MessageSquareText size={22} /> },
  { href: "/billing", label: "Billing", icon: <CreditCard size={22} /> },
];

export function AppShell({ children, account }: { children: ReactNode; account: ReactNode }) {
  // The agent lays out its own panes: chat history sits on the surface next to the rail, like a drawer.
  const fullBleed = usePathname().startsWith("/chat");
  return (
    <SnackbarProvider>
      <Tooltip.Provider delayDuration={300}>
        <div className="flex min-h-dvh bg-surface">
          <NavigationRail
            items={items}
            header={
              <Link href="/" aria-label="mcprouter home" className="rounded-md">
                <Logo size={40} />
              </Link>
            }
            footer={account}
          />
          <main className={cn("min-w-0 flex-1", fullBleed ? "pb-20 md:pb-0" : "px-4 pt-6 pb-28 md:rounded-tl-xl md:bg-surface-container-lowest md:px-8 md:pb-10")}>
            {fullBleed ? children : <div className="mx-auto max-w-6xl">{children}</div>}
          </main>
          <NavigationBar items={items} />
        </div>
      </Tooltip.Provider>
    </SnackbarProvider>
  );
}
