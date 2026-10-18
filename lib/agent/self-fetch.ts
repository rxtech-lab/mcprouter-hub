import "server-only";
import { services } from "@/generated/registry";
import { createServiceRoute } from "@/lib/mcp/handler";

const route = createServiceRoute(() => services);

/**
 * Calls this app's own MCP route in-process. Going through the public URL
 * breaks when the domain redirects (e.g. apex → www): fetch drops the
 * Authorization header on a cross-origin redirect, so every call is a 401.
 */
export const selfMcpFetch: typeof fetch = async (input, init) => route(new Request(input, init));
