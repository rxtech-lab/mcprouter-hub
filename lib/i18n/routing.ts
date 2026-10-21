import { isLocale, type Locale } from "./config";

/** Only public content gets language prefixes; account and protocol URLs stay unchanged. */
export function publicPath(pathname: string) {
  return pathname === "/" || pathname === "/sources" || pathname.startsWith("/sources/")
    || pathname === "/guides" || pathname.startsWith("/guides/");
}

export function splitLocalePath(pathname: string) {
  const [first, ...rest] = pathname.slice(1).split("/");
  return isLocale(first)
    ? { locale: first, pathname: `/${rest.join("/")}` }
    : { locale: null, pathname };
}

export function localizedHref(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const path = href.split(/[?#]/, 1)[0];
  if (splitLocalePath(path).locale || !publicPath(path)) return href;
  return `/${locale}${href === "/" ? "" : href.startsWith("/?") || href.startsWith("/#") ? href.slice(1) : href}`;
}
