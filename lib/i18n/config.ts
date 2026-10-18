/** Locales the UI is translated into. English is the source language: its strings are the msgids in `locales/<locale>/messages.po`. */
export const LOCALES = ["en", "zh-CN", "zh-HK"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Set only when the user picks a language; until then the locale follows the browser's `Accept-Language`. */
export const LOCALE_COOKIE = "locale";

/** Each language named in itself, so a reader can find theirs whatever the current UI language. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  "zh-CN": "简体中文",
  "zh-HK": "繁體中文（香港）",
};

/** BCP 47 tags for `Intl` formatters; English keeps Hong Kong conventions (day-month dates, HKD). */
export const INTL_LOCALES: Record<Locale, string> = {
  en: "en-HK",
  "zh-CN": "zh-CN",
  "zh-HK": "zh-HK",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Maps one language tag to a supported locale: Traditional Chinese regions and scripts read zh-HK, other Chinese zh-CN. */
function localeForTag(tag: string): Locale | null {
  const parts = tag.toLowerCase().split(/[-_]/);
  if (parts[0] === "en") return "en";
  if (parts[0] !== "zh" && parts[0] !== "yue") return null;
  if (parts[0] === "yue" || parts.some((part) => ["hant", "hk", "mo", "tw"].includes(part))) return "zh-HK";
  return "zh-CN";
}

/** Picks the best supported locale from an `Accept-Language` header, honouring q-values. */
export function matchLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((entry, index) => {
      const [tag, ...params] = entry.trim().split(";");
      const q = params.map((param) => param.trim()).find((param) => param.startsWith("q="));
      return { tag: tag.trim(), q: q ? Number(q.slice(2)) : 1, index };
    })
    .filter((entry) => entry.tag && entry.tag !== "*" && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const entry of ranked) {
    const locale = localeForTag(entry.tag);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}
