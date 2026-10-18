import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { CallChannel } from "@/db/schema";
import { findUsableApiKey, GUEST_USER_PREFIX, INTERNAL_CHANNEL_HEADER, INTERNAL_USER_HEADER, matchesInternalKey } from "@/lib/api-keys";
import { ACCESS_TOKEN_PREFIX, authenticateAccessToken, OAUTH_SCOPE, oauthOrigin } from "@/lib/mcp/oauth";
import { MCP_APP_EXTENSION, MCP_APP_MIME_TYPE } from "@/lib/mcp/apps";
import { registerServices } from "@/lib/mcp/register";
import type { CallerContext, ServiceDefinition } from "@/lib/mcp/types";

type CallerExtra = { userId: string; apiKeyId: string | null; scopes: string[]; guest?: boolean; channel: CallChannel; oauthClientId?: string | null };

const AGENT_CHANNELS = new Set<CallChannel>(["web", "telegram", "whatsapp"]);

/** The agent surface named by the internal caller; anything else counts as the web chat. */
function agentChannel(request: Request, guest: boolean): CallChannel {
  if (guest) return "free";
  const claimed = request.headers.get(INTERNAL_CHANNEL_HEADER)?.trim() as CallChannel | undefined;
  return claimed && AGENT_CHANNELS.has(claimed) ? claimed : "web";
}

/**
 * Accepts an `mcpr_…` key as a Bearer header or `?token=`, an OAuth access
 * token as a Bearer header, or the internal agent key together with the user
 * it acts for.
 */
export async function verifyMcpToken(request: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  const token = bearerToken ?? new URL(request.url).searchParams.get("token") ?? undefined;
  if (!token) return undefined;

  if (matchesInternalKey(token)) {
    const userId = request.headers.get(INTERNAL_USER_HEADER)?.trim();
    if (!userId) return undefined;
    // Only the internal key can claim to be a guest, so a guest id can't be used to dodge billing.
    const guest = userId.startsWith(GUEST_USER_PREFIX);
    const extra: CallerExtra = { userId, apiKeyId: null, scopes: [], guest, channel: agentChannel(request, guest) };
    return { token, clientId: "mcprouter-agent", scopes: [], extra };
  }

  if (token.startsWith(ACCESS_TOKEN_PREFIX)) {
    // OAuth tokens are only accepted in the header, never in the URL.
    if (bearerToken !== token) return undefined;
    const grant = await authenticateAccessToken(token, new URL(request.url).pathname);
    if (!grant) return undefined;
    const scopes = grant.service ? [grant.service] : [];
    const extra: CallerExtra = { userId: grant.userId, apiKeyId: null, scopes, channel: "oauth", oauthClientId: grant.clientId };
    return { token, clientId: grant.clientId, scopes: [OAUTH_SCOPE], expiresAt: Math.floor(grant.expiresAt.getTime() / 1000), extra };
  }

  const key = await findUsableApiKey(token);
  if (!key) return undefined;
  const extra: CallerExtra = { userId: key.userId, apiKeyId: key.id, scopes: key.scopes, channel: "key" };
  return { token, clientId: key.id, scopes: key.scopes, extra };
}

function callerFrom(request: Request): CallerContext | null {
  const extra = request.auth?.extra as CallerExtra | undefined;
  if (!extra?.userId) return null;
  return {
    userId: extra.userId,
    apiKeyId: extra.apiKeyId,
    scopes: extra.scopes ?? [],
    guest: extra.guest ?? false,
    channel: extra.channel,
    oauthClientId: extra.oauthClientId ?? null,
  };
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
      // Tool results can render as MCP Apps; hosts without the extension still get JSON text.
      capabilities: { extensions: { [MCP_APP_EXTENSION]: { mimeTypes: [MCP_APP_MIME_TYPE] } } },
      verboseLogs: false,
    });
    return mcp(request);
  };
  // A 401 points the client at this endpoint's resource metadata, which is how OAuth clients discover sign-in.
  return (request: Request) =>
    withMcpAuth(handler, verifyMcpToken, {
      required: true,
      resourceMetadataPath: `/.well-known/oauth-protected-resource${new URL(request.url).pathname}`,
      resourceUrl: oauthOrigin(request),
    })(request);
}
