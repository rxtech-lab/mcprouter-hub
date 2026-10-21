import Link from "@/components/localized-link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/m3/button";
import { cn } from "@/components/m3/cn";
import { LanguageMenu } from "@/components/language-menu";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { SiteSearch } from "@/components/site-search";
import { searchNavigation } from "@/lib/site-search/catalogue";

/** Top app bar for the public pages: landing, data sources and the free agent. */
export async function SiteHeader({ active, className }: { active?: "sources" | "guides" | "pricing"; className?: string }) {
  const t = await getT();
  return (
    <header className={cn("sticky top-0 z-20 bg-surface/90 backdrop-blur", className)}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-3 rounded-md">
          <Logo size={36} />
          <span className="type-title-large max-sm:hidden">mcprouter</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Suspense fallback={<span className="inline-flex h-10 items-center px-4 type-label-large">{t("Search")}</span>}>
            <SiteSearch active={active} destinations={searchNavigation(t)} />
          </Suspense>
          <LanguageMenu />
          <Suspense fallback={<AccountAction signedIn={false} label={t("Sign in")} />}>
            <SessionAction />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

async function SessionAction() {
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);
  return <AccountAction signedIn={Boolean(user)} label={user ? t("Dashboard") : t("Sign in")} />;
}

function AccountAction({ signedIn, label }: { signedIn: boolean; label: string }) {
  return (
    <ButtonLink href={signedIn ? "/dashboard" : "/login"} variant="filled" className="ml-1 max-sm:px-4" data-analytics-event="navigation_click" data-analytics-label={signedIn ? "dashboard" : "login"}>
      {label}
    </ButtonLink>
  );
}
