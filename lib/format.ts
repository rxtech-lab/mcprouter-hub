import { INTL_LOCALES, type Locale } from "@/lib/i18n/config";

const timeZone = "Asia/Hong_Kong";
const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();

/** Formatters are costly to build, so each (locale, kind) pair is made once. */
function formatter<T extends Intl.DateTimeFormat | Intl.NumberFormat>(locale: Locale, kind: string, make: (tag: string) => T): T {
  const key = `${locale}:${kind}`;
  if (!cache.has(key)) cache.set(key, make(INTL_LOCALES[locale]));
  return cache.get(key) as T;
}

export function formatDate(value: Date | string | number | null | undefined, locale: Locale = "en") {
  return value ? formatter(locale, "date", (tag) => new Intl.DateTimeFormat(tag, { dateStyle: "medium", timeZone })).format(new Date(value)) : "—";
}

export function formatDateTime(value: Date | string | number | null | undefined, locale: Locale = "en") {
  return value
    ? formatter(locale, "datetime", (tag) => new Intl.DateTimeFormat(tag, { dateStyle: "medium", timeStyle: "short", timeZone })).format(new Date(value))
    : "—";
}

export function formatNumber(value: number, locale: Locale = "en") {
  return formatter(locale, "number", (tag) => new Intl.NumberFormat(tag)).format(value);
}

const NEVER: Record<Locale, string> = { en: "Never", "zh-CN": "从未", "zh-HK": "從未" };

export function formatRelative(value: Date | string | number | null | undefined, now = Date.now(), locale: Locale = "en") {
  if (!value) return NEVER[locale];
  const seconds = Math.round((new Date(value).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(INTL_LOCALES[locale], { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, "second");
}
