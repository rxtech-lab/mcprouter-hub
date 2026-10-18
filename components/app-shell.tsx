"use client";

import { BarChart3, Blocks, CreditCard, KeyRound, LayoutDashboard, MessageSquareText, Radar, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip } from "radix-ui";
import type { ReactNode } from "react";
import { LanguageMenu } from "@/components/language-menu";
import { Logo } from "@/components/logo";
import { cn } from "@/components/m3/cn";
import { NavigationBar, NavigationRail, type NavItem } from "@/components/m3/navigation";
import { SnackbarProvider } from "@/components/m3/snackbar";
import { useT } from "@/lib/i18n/client";
import { msg } from "@/lib/i18n/translate";

const items: NavItem[] = [
  { href: "/dashboard", label: msg("Overview"), icon: <LayoutDashboard size={22} /> },
  { href: "/keys", label: msg("API keys"), icon: <KeyRound size={22} /> },
  { href: "/usage", label: msg("Usage"), icon: <BarChart3 size={22} /> },
  { href: "/services", label: msg("Services"), icon: <Blocks size={22} /> },
  { href: "/tracker", label: msg("Tracker"), icon: <Radar size={22} /> },
  { href: "/chat", label: msg("Agent"), icon: <MessageSquareText size={22} /> },
  { href: "/billing", label: msg("Billing"), icon: <CreditCard size={22} /> },
  { href: "/settings", label: msg("Settings"), icon: <Settings size={22} /> },
];

export function AppShell({ children, account }: { children: ReactNode; account: ReactNode }) {
  // The agent lays out its own panes: chat history sits on the surface next to the rail, like a drawer.
  const fullBleed = usePathname().startsWith("/chat");
  const t = useT();
  const navItems = items.map((item) => ({ ...item, label: t(item.label) }));
  return (
    <SnackbarProvider>
      <Tooltip.Provider delayDuration={300}>
        <div className="flex min-h-dvh bg-surface">
          <NavigationRail
            items={navItems}
            header={
              <Link href="/" aria-label={t("mcprouter home")} className="rounded-md">
                <Logo size={40} />
              </Link>
            }
            footer={
              <div className="flex flex-col items-center gap-3">
                <LanguageMenu side="right" />
                {account}
              </div>
            }
          />
          <main className={cn("min-w-0 flex-1", fullBleed ? "pb-20 md:pb-0" : "px-4 pt-6 pb-28 md:rounded-tl-xl md:bg-surface-container-lowest md:px-8 md:pb-10")}>
            {fullBleed ? children : <div className="mx-auto max-w-6xl">{children}</div>}
          </main>
          <NavigationBar items={navItems} />
        </div>
      </Tooltip.Provider>
    </SnackbarProvider>
  );
}
