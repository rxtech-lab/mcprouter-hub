"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useLocale } from "@/lib/i18n/client";
import { localizedHref } from "@/lib/i18n/routing";

/** Renders crawlable, localized anchors on the server as well as on the client. */
export default function LocalizedLink({ href, ...props }: ComponentProps<typeof Link>) {
  const locale = useLocale();
  const localized = typeof href === "string" ? localizedHref(href, locale)
    : { ...href, pathname: href.pathname ? localizedHref(href.pathname, locale) : href.pathname };
  return <Link href={localized} {...props} />;
}
