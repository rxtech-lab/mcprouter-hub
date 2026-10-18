"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import type { Messages } from "./po";
import { createTranslator, type Translator } from "./translate";

const I18nContext = createContext<Translator>(createTranslator(DEFAULT_LOCALE, {}));

/** Hands the request's locale and catalogue, resolved on the server, to Client Components. */
export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  const t = useMemo(() => createTranslator(locale, messages), [locale, messages]);
  return <I18nContext.Provider value={t}>{children}</I18nContext.Provider>;
}

/** Translator for Client Components. */
export function useT() {
  return useContext(I18nContext);
}

export function useLocale() {
  return useContext(I18nContext).locale;
}
