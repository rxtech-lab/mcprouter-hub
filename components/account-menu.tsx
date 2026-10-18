"use client";

import { LoaderCircle, LogOut } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useTransition } from "react";
import { useT } from "@/lib/i18n/client";

type Props = {
  name: string;
  email: string;
  /** Server action that signs out and redirects; absent for the development bypass user. */
  signOut?: () => Promise<void>;
};

/** Avatar at the foot of the navigation rail; opens a menu with the account and sign out. */
export function AccountMenu({ name, email, signOut }: Props) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t("Account")}
          title={name}
          className="state-layer inline-flex size-10 cursor-pointer items-center justify-center rounded-full bg-tertiary-container type-label-large text-on-tertiary-container data-[state=open]:ring-2 data-[state=open]:ring-primary"
        >
          {initials || "?"}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="right" align="end" sideOffset={8} className="z-50 min-w-60 origin-(--radix-dropdown-menu-content-transform-origin) animate-menu-in rounded-xs data-[state=closed]:animate-fade-out bg-surface-container py-2 shadow-elevation-2">
          <div className="flex items-center gap-3 px-3 pt-1 pb-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-tertiary-container type-label-large text-on-tertiary-container">{initials || "?"}</span>
            <div className="min-w-0">
              <p className="truncate type-title-small text-on-surface">{name}</p>
              <p className="truncate type-body-small text-on-surface-variant">{signOut ? email || t("Signed in") : t("Development bypass")}</p>
            </div>
          </div>
          {signOut ? (
            <>
              <DropdownMenu.Separator className="mb-2 h-px bg-outline-variant" />
              <DropdownMenu.Item
                disabled={pending}
                onSelect={(event) => {
                  event.preventDefault();
                  startTransition(() => signOut());
                }}
                className="state-layer flex h-12 cursor-pointer items-center gap-3 px-3 type-label-large text-on-surface outline-none data-[disabled]:opacity-60 data-[highlighted]:bg-on-surface/8"
              >
                {pending ? <LoaderCircle size={20} className="animate-spin text-on-surface-variant" /> : <LogOut size={20} className="text-on-surface-variant" />}
                {pending ? t("Signing out…") : t("Sign out")}

              </DropdownMenu.Item>
            </>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
