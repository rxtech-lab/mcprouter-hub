import zhCN from "@/generated/i18n/zh-CN.json";
import zhHK from "@/generated/i18n/zh-HK.json";
import type { Locale } from "./config";
import type { Messages } from "./po";

/** Compiled from `locales/<locale>/messages.po` by `bun run codegen`. English strings are the msgids, so it needs no catalogue. */
const catalogues: Record<Locale, Messages> = {
  en: {},
  "zh-CN": zhCN,
  "zh-HK": zhHK,
};

export function getMessages(locale: Locale): Messages {
  return catalogues[locale];
}
