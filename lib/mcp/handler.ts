import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { findUsableApiKey, GUEST_USER_PREFIX, INTERNAL_USER_HEADER, matchesInternalKey } from "@/lib/api-keys";
import { registerServices } from "@/lib/mcp/register";
import type { CallerContext, ServiceDefinition } from "@/lib/mcp/types";

type CallerExtra = { userId: string; apiKeyId: string | null; scopes: string[]; guest?: boolean };

/**
 * Accepts an `mcpr_…` key as a Bearer header or `?token=`, or the internal
 * agent key together with the user it acts for.
 */
export async function verifyMcpToken(request: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  const token = bearerToken ?? new URL(request.url).searchParams.get("token") ?? undefined;
  if (!token) return undefined;

  if (matchesInternalKey(token)) {
    const userId = request.headers.get(INTERNAL_USER_HEADER)?.trim();
    if (!userId) return undefined;
    // Only the internal key can claim to be a guest, so a guest id can't be used to dodge billing.
    const extra: CallerExtra = { userId, apiKeyId: null, scopes: [], guest: userId.startsWith(GUEST_USER_PREFIX) };
    return { token, clientId: "mcprouter-agent", scopes: [], extra };
  }

  const key = await findUsableApiKey(token);
  if (!key) return undefined;
  const extra: CallerExtra = { userId: key.userId, apiKeyId: key.id, scopes: key.scopes };
  return { token, clientId: key.id, scopes: key.scopes, extra };
}

function callerFrom(request: Request): CallerContext | null {
  const extra = request.auth?.extra as CallerExtra | undefined;
  if (!extra?.userId) return null;
  return { userId: extra.userId, apiKeyId: extra.apiKeyId, scopes: extra.scopes ?? [], guest: extra.guest ?? false };
}

/**
 * Builds the route handler. The MCP server is created per request (the
 * transport is stateless) so the tool list can be cut down to what the
 * caller's key is scoped to.
 */
export function createServiceRoute(selectServices: (request: Request) => readonly ServiceDefinition[] | null) {
  const handler = async (request: Request) => {
    const caller = callerFrom(request);
    if (!caller) return Response.json({ error: "unauthorized" }, { status: 401 });
    const services = selectServices(request);
    if (!services) return Response.json({ error: "unknown_service" }, { status: 404 });
    const mcp = createMcpHandler((server) => registerServices(server, services, caller), {
      serverInfo: { name: "mcprouter", version: "1.0.0" },
      verboseLogs: false,
    });
    return mcp(request);
  };
  return withMcpAuth(handler, verifyMcpToken, { required: true });
}
