"use client";

import { MoreVertical } from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import type { ReactNode } from "react";
import { IconButton } from "@/components/m3/button";
import { cn } from "@/components/m3/cn";

/** A card's actions behind a ⋮ button. `label` names the button for screen readers. */
export function ActionsMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <IconButton label={label}>
          <MoreVertical size={20} />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-48 rounded-xs bg-surface-container py-2 shadow-elevation-2">
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

type ActionsMenuItemProps = { icon: ReactNode; children: ReactNode; danger?: boolean } & (
  | { onSelect: () => void; href?: never }
  /** Opens a dialog kept in the URL. */
  | { href: string; onSelect?: never }
);

export function ActionsMenuItem({ icon, children, danger, onSelect, href }: ActionsMenuItemProps) {
  const className = cn(
    "flex h-12 cursor-pointer items-center gap-3 px-3 type-label-large outline-none data-[highlighted]:bg-on-surface/8",
    danger ? "text-error" : "text-on-surface",
  );
  if (href) {
    return (
      <DropdownMenu.Item asChild className={className}>
        <Link href={href} scroll={false}>
          {icon}
          {children}
        </Link>
      </DropdownMenu.Item>
    );
  }
  return (
    <DropdownMenu.Item onSelect={onSelect} className={className}>
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

export function ActionsMenuSeparator() {
  return <DropdownMenu.Separator className="my-2 h-px bg-outline-variant" />;
}
