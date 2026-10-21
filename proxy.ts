import { proxy as authProxy } from "@/lib/auth";
import { isPublicCacheRequest, isPublicPage, PUBLIC_CACHE_CONTROL } from "@/lib/public-cache";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { publicPath, splitLocalePath } from "@/lib/i18n/routing";

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const route = splitLocalePath(request.nextUrl.pathname);
  const localized = Boolean(route.locale && publicPath(route.pathname));
  const forwarded = new Headers(request.headers);
  // Never trust caller-supplied locale or canonical metadata headers.
  for (const name of ["x-site-locale", "x-site-path", "x-site-query"]) forwarded.delete(name);
  forwarded.set("x-site-path", localized ? route.pathname : request.nextUrl.pathname);
  forwarded.set("x-site-query", request.nextUrl.search.slice(1));
  if (localized) forwarded.set("x-site-locale", route.locale!);
  // NextURL normalizes loopback hostnames to localhost. Preserve the raw origin
  // so a self-hosted rewrite stays internal and keeps the forwarded headers.
  const target = new URL(request.url);
  if (localized) target.pathname = route.pathname;
  const routing = localized ? NextResponse.rewrite(target, { request: { headers: forwarded } })
    : NextResponse.next({ request: { headers: forwarded } });
  // There is no browser session to rotate without cookies. In particular, do
  // not mint Auth.js CSRF/callback cookies on public crawler requests.
  const anonymousPublic = (isPublicPage(request.nextUrl.pathname) || localized
    || target.pathname === "/guides" || /^\/guides\/[^/]+$/.test(target.pathname)
    || target.pathname === "/sources/providers" || /^\/sources\/(providers|api)\/[^/]+$/.test(target.pathname))
    && !request.headers.has("cookie") && !request.headers.has("authorization");
  const response = (anonymousPublic ? routing : await authProxy(request, event)) ?? routing;
  if (response && response.status === 200) {
    routing.headers.forEach((value, name) => response.headers.set(name, value));
    if (localized) response.headers.delete("x-middleware-next");
  }
  // Keep browser/Next.js Cache-Control unchanged. Only Cloudflare may share
  // these responses, after the matching request-side rules are installed.
  if (response) {
    const enabled = process.env.NODE_ENV === "production"
      && process.env.PUBLIC_CDN_CACHE_ENABLED === "true"
      && process.env.DEV_BYPASS_AUTH !== "true";
    response.headers.set("Cloudflare-CDN-Cache-Control",
      enabled && isPublicCacheRequest(request) && !response.headers.has("set-cookie")
        ? PUBLIC_CACHE_CONTROL : "no-store");
  }
  return response;
}

/**
 * The proxy only refreshes the browser's session cookie; it never blocks a
 * request. `api/mcp` (including its OAuth endpoints) authenticates with bearer tokens, `api/whatsapp` and `api/telegram` with their webhook secrets, so the
 * session refresh is skipped on those hot paths, and on the public `.well-known` metadata and the MCP App sandbox page.
 */
export const config = {
  matcher: [
    "/((?!api/auth|api/mcp|api/whatsapp|api/telegram|mcp-app-sandbox|\\.well-known|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
