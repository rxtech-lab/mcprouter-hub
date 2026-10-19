import { proxy as authProxy } from "@/lib/auth";
import { isPublicCacheRequest, isPublicPage, PUBLIC_CACHE_CONTROL } from "@/lib/public-cache";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  // There is no browser session to rotate without cookies. In particular, do
  // not mint Auth.js CSRF/callback cookies on public crawler requests.
  const anonymousPublic = isPublicPage(request.nextUrl.pathname)
    && !request.headers.has("cookie") && !request.headers.has("authorization");
  const response = anonymousPublic ? NextResponse.next() : await authProxy(request, event);
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
