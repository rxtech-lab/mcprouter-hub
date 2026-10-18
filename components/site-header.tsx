import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/m3/button";
import { cn } from "@/components/m3/cn";
import { getCurrentUser } from "@/lib/auth";

const links = [
  { href: "/sources", label: "Data sources", key: "sources" },
] as const;

/** Top app bar for the public pages: landing, data sources and the free agent. */
export function SiteHeader({ active, className }: { active?: (typeof links)[number]["key"]; className?: string }) {
  return (
    <header className={cn("sticky top-0 z-20 bg-surface/90 backdrop-blur", className)}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-3 rounded-md">
          <Logo size={36} />
          <span className="type-title-large max-sm:hidden">mcprouter</span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              aria-current={active === link.key ? "page" : undefined}
              className={cn(
                "state-layer inline-flex h-10 items-center rounded-full px-4 type-label-large",
                active === link.key ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant",
              )}
            >
              {link.label}
            </Link>
          ))}
          <Suspense fallback={<AccountAction signedIn={false} />}>
            <SessionAction />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

async function SessionAction() {
  const user = await getCurrentUser();
  return <AccountAction signedIn={Boolean(user)} />;
}

function AccountAction({ signedIn }: { signedIn: boolean }) {
  return signedIn ? (
    <ButtonLink href="/dashboard" variant="filled" className="ml-1 max-sm:px-4">Dashboard</ButtonLink>
  ) : (
    <ButtonLink href="/login" variant="filled" className="ml-1 max-sm:px-4">Sign in</ButtonLink>
  );
}
