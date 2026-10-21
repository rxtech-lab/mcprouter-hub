import type { Metadata } from "next";
import { headers } from "next/headers";
import { getLocale } from "@/lib/i18n/server";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { localizedHref, publicPath } from "@/lib/i18n/routing";

/** Canonicals use the configured public origin, never a request-controlled Host header. */
export function seoOrigin() {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://mcprouter.app").origin;
}

export function languageAlternates(path: string) {
  return Object.fromEntries([
    ...LOCALES.map((locale) => [locale, `${seoOrigin()}${localizedHref(path, locale)}`]),
    ["x-default", `${seoOrigin()}${localizedHref(path, "en")}`],
  ]);
}

export function canonicalQuery(path: string, query: URLSearchParams) {
  const result = new URLSearchParams();
  // Lists retain their distinct pages. Dialog, chat and tracking state never change canonical content.
  if (path === "/sources/apis" || path === "/sources/providers" || path.startsWith("/sources/providers/")) {
    const page = query.get("page");
    if (page && /^[1-9]\d*$/.test(page) && Number.isSafeInteger(Number(page)) && Number(page) > 1) result.set("page", page);
  }
  return result.size ? `?${result}` : "";
}

export function indexableQuery(query: URLSearchParams) {
  return !["q", "status", "category", "kind"].some((key) => query.has(key)) && !(query.get("api") === "1");
}

export async function seoMetadata(title: string, description: string, pathOverride?: string): Promise<Metadata> {
  const [requestHeaders, locale] = await Promise.all([headers(), getLocale()]);
  const path = pathOverride ?? requestHeaders.get("x-site-path") ?? "/";
  const query = new URLSearchParams(requestHeaders.get("x-site-query") ?? "");
  const suffix = canonicalQuery(path, query);
  const canonical = `${seoOrigin()}${localizedHref(path, locale)}${suffix}`;
  const languages = languageAlternates(`${path}${suffix}`);
  return {
    title, description,
    alternates: publicPath(path) ? { canonical, languages } : undefined,
    robots: { index: publicPath(path) && indexableQuery(query), follow: true },
    openGraph: {
      title: `${title} · MCPRouter`, description, url: canonical, siteName: "MCPRouter", type: "website",
      locale: ({ en: "en_HK", "zh-CN": "zh_CN", "zh-HK": "zh_HK" } satisfies Record<Locale, string>)[locale],
      images: [{ url: `${seoOrigin()}/opengraph-image.png`, alt: "MCPRouter by RxLab" }],
    },
    twitter: { card: "summary_large_image", title: `${title} · MCPRouter`, description, images: [`${seoOrigin()}/opengraph-image.png`] },
  };
}
