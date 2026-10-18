"use client";

import { Check, Languages, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useTransition } from "react";
import { cn } from "@/components/m3/cn";
import { setLocale } from "@/lib/i18n/actions";
import { useT } from "@/lib/i18n/client";
import { LOCALE_LABELS, LOCALES } from "@/lib/i18n/config";

/**
 * Icon button that opens the language menu, in the navigation rail and the public top app bar.
 * Picking a language saves it in a cookie and re-renders the current page on the server.
 */
export function LanguageMenu({ side = "bottom", className }: { side?: "bottom" | "right"; className?: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (locale: string) => {
    if (locale === t.locale) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t("Language")}
          title={t("Language")}
          aria-busy={pending}
          className={cn(
            "state-layer inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-on-surface-variant data-[state=open]:bg-secondary-container data-[state=open]:text-on-secondary-container",
            className,
          )}
        >
          {pending ? <LoaderCircle size={20} className="animate-spin" /> : <Languages size={20} />}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side={side}
          align="end"
          sideOffset={8}
          className="z-50 min-w-56 origin-(--radix-dropdown-menu-content-transform-origin) animate-menu-in rounded-xs bg-surface-container py-2 shadow-elevation-2 data-[state=closed]:animate-fade-out"
        >
          <DropdownMenu.Label className="px-3 pt-1 pb-2 type-label-medium text-on-surface-variant">{t("Language")}</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={t.locale} onValueChange={choose}>
            {LOCALES.map((locale) => (
              <DropdownMenu.RadioItem
                key={locale}
                value={locale}
                lang={locale}
                disabled={pending}
                className="state-layer flex h-12 cursor-pointer items-center gap-3 px-3 type-label-large text-on-surface outline-none data-[disabled]:opacity-60 data-[highlighted]:bg-on-surface/8"
              >
                <span className="flex size-5 items-center justify-center text-primary">
                  <DropdownMenu.ItemIndicator>
                    <Check size={20} />
                  </DropdownMenu.ItemIndicator>
                </span>
                {LOCALE_LABELS[locale]}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
