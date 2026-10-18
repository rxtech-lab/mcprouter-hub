import { proxy as authProxy } from "@/lib/auth";
import type { NextFetchEvent, NextRequest } from "next/server";

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  return authProxy(request, event);
}

/**
 * The proxy only refreshes the browser's session cookie; it never blocks a
 * request. `api/mcp` (including its OAuth endpoints) and `api/cron` authenticate with bearer tokens, `api/whatsapp` and `api/telegram` with their webhook secrets, so the
 * session refresh is skipped on those hot paths, and on the public `.well-known` metadata and the MCP App sandbox page.
 */
export const config = {
  matcher: [
    "/((?!api/auth|api/mcp|api/cron|api/whatsapp|api/telegram|mcp-app-sandbox|\\.well-known|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
