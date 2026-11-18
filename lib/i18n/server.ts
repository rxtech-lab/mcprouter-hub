import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { isLocale, LOCALE_COOKIE, matchLocale, type Locale } from "./config";
import { getMessages } from "./messages";
import { createTranslator } from "./translate";

// React scopes this object to a single server render. Static catalogue entries
// set it from validated route parameters before sharing the ordinary page UI.
export const catalogueRender = cache((): { locale?: Locale; path?: string; query?: string } => ({}));

/** The saved choice from the language menu, else the browser's preferred language. */
export const getLocale = cache(async (): Promise<Locale> => {
  const explicit = catalogueRender().locale;
  if (explicit) return explicit;
  const routed = (await headers()).get("x-site-locale");
  if (isLocale(routed)) return routed;
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return matchLocale((await headers()).get("accept-language"));
});

/** Translator for Server Components, server actions and metadata. */
export const getT = cache(async () => {
  const locale = await getLocale();
  return createTranslator(locale, getMessages(locale));
});
