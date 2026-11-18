import { NextResponse } from "next/server";
import { PUBLIC_CACHE_CONTROL, PUBLIC_CACHE_HOST } from "./public-cache";
import type { Locale } from "./i18n/config";

export async function publicCatalogueResponse(url: { search: string }, locale: Locale, path: string) {
  const variant = url.search ? `q-${Buffer.from(url.search.slice(1)).toString("base64url")}` : "index";
  const view = path === "/sources/apis" ? "apis" : "services";
  // Never forward client headers, credentials, or a client-controlled origin.
  const origin = new URL(`/catalogue-render/${locale}/${view}/${variant}`, `https://${PUBLIC_CACHE_HOST}`);
  try {
    const upstream = await fetch(origin, { headers: { accept: "text/html" }, redirect: "manual", signal: AbortSignal.timeout(15000) });
    const headers = upstream.headers;
    const policy = headers.get("cache-control") ?? "";
    const html = /^text\/html(?:;|$)/i.test(headers.get("content-type") ?? "");
    if (upstream.status !== 200 || !html || headers.has("set-cookie") || headers.get("vary")?.split(",").some(token => token.trim() === "*") ||
      !/(?:^|,)\s*(?:public|s-maxage=300)\s*(?:,|$)/i.test(policy) ||
      /(?:^|,)\s*(?:private|no-store|no-cache)\b/i.test(policy) ||
      ["cloudflare-cdn-cache-control", "cdn-cache-control", "vercel-cdn-cache-control"].some(name => /private|no-store|no-cache/i.test(headers.get(name) ?? ""))) {
      await upstream.body?.cancel();
      return null;
    }
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, { headers: {
      "Content-Type": headers.get("content-type")!,
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Cloudflare-CDN-Cache-Control": PUBLIC_CACHE_CONTROL,
      "Vercel-CDN-Cache-Control": "no-store",
      "Vary": "Cookie, Authorization, Accept, Accept-Language, RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch",
    } });
  } catch {
    // An unavailable or incomplete static render falls back to the normal page.
    return null;
  }
}
