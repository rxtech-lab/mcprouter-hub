import { proxy as authProxy } from "@/lib/auth";
import type { NextFetchEvent, NextRequest } from "next/server";

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  return authProxy(request, event);
}

/**
 * The proxy only refreshes the browser's session cookie; it never blocks a
 * request. `api/mcp` and `api/cron` authenticate with bearer tokens, so the
 * session refresh is skipped on those hot paths.
 */
export const config = {
  matcher: [
    "/((?!api/auth|api/mcp|api/cron|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
