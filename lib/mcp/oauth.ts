import crypto from "node:crypto";
import { and, count, eq, gt, isNotNull, isNull, lt, or } from "drizzle-orm";
import { getPublicOrigin } from "mcp-handler";
import { z } from "zod";
import { db } from "@/db";
import { oauthClients, oauthCodes, oauthGrants, oauthTokens, type OAuthClient, type OAuthGrant } from "@/db/schema";
import { serviceById } from "@/generated/registry";
import { shouldTouchLastUsed } from "@/lib/api-keys";

/**
 * mcprouter is its own OAuth 2.1 authorization server for the MCP endpoints:
 * public clients register dynamically, the user signs in with their normal
 * mcprouter session and approves on /oauth/authorize, and the client gets an
 * opaque access token bound to the approved endpoint. API keys keep working.
 */

export const OAUTH_SCOPE = "mcp";
export const ACCESS_TOKEN_PREFIX = "mcpo_at_";
export const REFRESH_TOKEN_PREFIX = "mcpo_rt_";
export const ACCESS_TOKEN_SECONDS = 3600;
/** Idle lifetime of a grant; every refresh extends it. */
export const GRANT_SECONDS = 30 * 86_400;
const CODE_SECONDS = 60;
const MAX_REGISTRATIONS_PER_MINUTE = 60;

export class OAuthError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export function secret(prefix = "") {
  return prefix + crypto.randomBytes(32).toString("base64url");
}

export function digest(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function pkceChallenge(verifier: string) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

/** Issuer and resource origin. NEXT_PUBLIC_SITE_URL wins so tokens don't depend on request headers. */
export function oauthOrigin(request?: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return new URL(configured).origin;
  if (!request) throw new Error("NEXT_PUBLIC_SITE_URL is not set");
  return getPublicOrigin(request);
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/mcp/oauth/token`,
    registration_endpoint: `${origin}/api/mcp/oauth/register`,
    revocation_endpoint: `${origin}/api/mcp/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [OAUTH_SCOPE],
    authorization_response_iss_parameter_supported: true,
  };
}

const MCP_PATH = /^\/api\/mcp\/(?:s\/([^/]+)\/)?(mcp|sse)$/;

export type McpResource = { url: string; service: string | null };

/** Parses an MCP endpoint path (`/api/mcp/mcp` or `/api/mcp/s/<service>/mcp`). */
export function parseMcpPath(pathname: string): { service: string | null } | null {
  const match = MCP_PATH.exec(pathname);
  if (!match) return null;
  if (!match[1]) return { service: null };
  const service = decodeURIComponent(match[1]);
  return serviceById.has(service) ? { service } : null;
}

/** The resource a token is for. Omitted means the all-services endpoint. */
export function resolveResource(value: string | null | undefined, origin: string): McpResource {
  if (!value) return { url: `${origin}/api/mcp/mcp`, service: null };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new OAuthError("invalid_target", "The resource must be an mcprouter MCP endpoint.");
  }
  const parsed = url.origin === origin && !url.search && !url.hash ? parseMcpPath(url.pathname.replace(/\/+$/, "")) : null;
  if (!parsed) throw new OAuthError("invalid_target", "The resource must be an mcprouter MCP endpoint.");
  return { url: `${origin}${url.pathname.replace(/\/+$/, "")}`, service: parsed.service };
}

export function protectedResourceMetadata(origin: string, pathname: string) {
  const parsed = parseMcpPath(pathname);
  const resource = parsed ? `${origin}${pathname}` : `${origin}/api/mcp/mcp`;
  return {
    resource,
    resource_name: parsed?.service ? `mcprouter · ${serviceById.get(parsed.service)?.title ?? parsed.service}` : "mcprouter",
    authorization_servers: [origin],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ["header"],
  };
}

const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "blob:", "about:", "ftp:", "ws:", "wss:"]);
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** HTTPS, loopback HTTP (RFC 8252 §7.3) or a native app's private-use scheme (§7.1). */
export function isValidRedirectUri(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password || BLOCKED_SCHEMES.has(url.protocol)) return false;
  if (url.protocol === "https:") return true;
  if (url.protocol === "http:") return LOOPBACK.has(url.hostname);
  return /^[a-z][a-z0-9+.-]*:$/.test(url.protocol);
}

/** Loopback redirects may use any port (RFC 8252 §7.3), since native clients pick one at runtime. */
export function redirectUriMatches(registered: readonly string[], candidate: string) {
  if (registered.includes(candidate)) return true;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" || !LOOPBACK.has(url.hostname)) return false;
  return registered.some((uri) => {
    const other = new URL(uri);
    other.port = url.port;
    return other.href === url.href;
  });
}

const registrationSchema = z.object({
  client_name: z.string().trim().min(1).max(100).catch("MCP client"),
  redirect_uris: z.array(z.string().max(2048).refine(isValidRedirectUri)).min(1).max(10),
  grant_types: z.array(z.string()).optional(),
});

export async function registerClient(metadata: unknown, now = new Date()) {
  const parsed = registrationSchema.safeParse(metadata);
  if (!parsed.success) {
    throw new OAuthError("invalid_redirect_uri", "Register HTTPS, loopback or app-scheme redirect URIs.");
  }
  if (parsed.data.grant_types && !parsed.data.grant_types.includes("authorization_code")) {
    throw new OAuthError("invalid_client_metadata", "The authorization_code grant is required.");
  }
  // Registration is anonymous, so cap how fast it can write rows.
  const [{ recent }] = await db
    .select({ recent: count() })
    .from(oauthClients)
    .where(gt(oauthClients.createdAt, new Date(now.getTime() - 60_000)));
  if (recent >= MAX_REGISTRATIONS_PER_MINUTE) {
    throw new OAuthError("temporarily_unavailable", "Too many client registrations. Try again in a minute.", 429);
  }
  const client = {
    id: `mcpc_${crypto.randomUUID()}`,
    name: parsed.data.client_name,
    redirectUris: [...new Set(parsed.data.redirect_uris)],
  };
  await db.insert(oauthClients).values({ ...client, createdAt: now });
  return {
    client_id: client.id,
    client_id_issued_at: Math.floor(now.getTime() / 1000),
    client_name: client.name,
    redirect_uris: client.redirectUris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    scope: OAUTH_SCOPE,
  };
}

export async function findClient(id: string): Promise<OAuthClient | null> {
  if (!id || id.length > 200) return null;
  const [client] = await db.select().from(oauthClients).where(eq(oauthClients.id, id)).limit(1);
  return client ?? null;
}

export type AuthorizationRequest = {
  client: OAuthClient;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  resource: McpResource;
};

export type AuthorizationCheck =
  | { ok: true; request: AuthorizationRequest }
  /** The client or redirect URI can't be trusted, so the error is shown here instead of redirected. */
  | { ok: false; redirectUri: null; message: string }
  | { ok: false; redirectUri: string; error: string; message: string; state: string | null };

type Params = Record<string, string | string[] | undefined>;

function single(params: Params, name: string) {
  const value = params[name];
  if (Array.isArray(value)) return undefined;
  return value && value.length <= 4096 ? value : undefined;
}

/** Validates `/oauth/authorize` query parameters. Shared by the consent page and its server action. */
export async function checkAuthorizationRequest(params: Params, origin: string): Promise<AuthorizationCheck> {
  const clientId = single(params, "client_id");
  const redirectUri = single(params, "redirect_uri");
  const client = clientId ? await findClient(clientId) : null;
  if (!client) return { ok: false, redirectUri: null, message: "This app isn't registered with mcprouter. Reconnect it from the app." };
  if (!redirectUri || !redirectUriMatches(client.redirectUris, redirectUri)) {
    return { ok: false, redirectUri: null, message: "This app asked to return to an address it didn't register." };
  }
  const state = single(params, "state") ?? null;
  const fail = (error: string, message: string) => ({ ok: false as const, redirectUri, error, message, state });

  if (single(params, "response_type") !== "code") return fail("unsupported_response_type", "Only the authorization code flow is supported.");
  if (single(params, "code_challenge_method") !== "S256") return fail("invalid_request", "S256 PKCE is required.");
  const codeChallenge = single(params, "code_challenge");
  if (!codeChallenge || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) return fail("invalid_request", "Invalid PKCE code_challenge.");
  try {
    const resource = resolveResource(single(params, "resource"), origin);
    return { ok: true, request: { client, redirectUri, state, codeChallenge, resource } };
  } catch (error) {
    if (error instanceof OAuthError) return fail(error.code, error.message);
    throw error;
  }
}

/** Where to send the browser back to the client, with the RFC 9207 `iss` parameter. */
export function clientRedirect(redirectUri: string, values: Record<string, string>, state: string | null, origin: string) {
  const url = new URL(redirectUri);
  for (const [name, value] of Object.entries(values)) url.searchParams.set(name, value);
  if (state !== null) url.searchParams.set("state", state);
  url.searchParams.set("iss", origin);
  return url.href;
}

/** Records the user's approval and returns a one-time authorization code. */
export async function approveAuthorization(userId: string, request: AuthorizationRequest, now = new Date()) {
  const grantId = crypto.randomUUID();
  const code = secret();
  await db.insert(oauthGrants).values({
    id: grantId,
    userId,
    clientId: request.client.id,
    resource: request.resource.url,
    service: request.resource.service,
    scope: OAUTH_SCOPE,
    expiresAt: new Date(now.getTime() + GRANT_SECONDS * 1000),
    createdAt: now,
  });
  await db.insert(oauthCodes).values({
    hash: digest(code),
    grantId,
    redirectUri: request.redirectUri,
    challenge: request.codeChallenge,
    expiresAt: new Date(now.getTime() + CODE_SECONDS * 1000),
  });
  return code;
}

async function revokeGrant(grantId: string, now: Date) {
  await db.update(oauthGrants).set({ revokedAt: now }).where(eq(oauthGrants.id, grantId));
}

async function issueTokens(grant: OAuthGrant, now: Date) {
  const access = secret(ACCESS_TOKEN_PREFIX);
  const refresh = secret(REFRESH_TOKEN_PREFIX);
  const expiresAt = new Date(now.getTime() + GRANT_SECONDS * 1000);
  await db.update(oauthGrants).set({ expiresAt }).where(eq(oauthGrants.id, grant.id));
  await db.insert(oauthTokens).values([
    { hash: digest(access), grantId: grant.id, kind: "access", expiresAt: new Date(now.getTime() + ACCESS_TOKEN_SECONDS * 1000) },
    { hash: digest(refresh), grantId: grant.id, kind: "refresh", expiresAt },
  ]);
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TOKEN_SECONDS, refresh_token: refresh, scope: grant.scope };
}

function grantUsable(grant: OAuthGrant, clientId: string, now: Date) {
  return grant.clientId === clientId && !grant.revokedAt && grant.expiresAt.getTime() > now.getTime();
}

/** A token request's `resource`, when given, must name the endpoint the grant was approved for. */
function resourceMatches(grant: OAuthGrant, resource: string | null, origin: string) {
  return !resource || resolveResource(resource, origin).url === grant.resource;
}

export async function exchangeCode(
  args: { code: string; clientId: string; redirectUri: string; verifier: string; resource: string | null; origin: string },
  now = new Date(),
) {
  const invalid = new OAuthError("invalid_grant", "The authorization code or PKCE verifier is invalid.");
  const [row] = await db
    .select({ code: oauthCodes, grant: oauthGrants })
    .from(oauthCodes)
    .innerJoin(oauthGrants, eq(oauthGrants.id, oauthCodes.grantId))
    .where(eq(oauthCodes.hash, digest(args.code)))
    .limit(1);
  if (!row || row.code.expiresAt.getTime() <= now.getTime() || !grantUsable(row.grant, args.clientId, now)) throw invalid;
  if (row.code.redirectUri !== args.redirectUri || !/^[A-Za-z0-9._~-]{43,128}$/.test(args.verifier)) throw invalid;
  if (pkceChallenge(args.verifier) !== row.code.challenge || !resourceMatches(row.grant, args.resource, args.origin)) throw invalid;
  // A code used twice may have been intercepted: revoke everything issued from it (RFC 6749 §4.1.2).
  const [claimed] = await db
    .update(oauthCodes)
    .set({ usedAt: now })
    .where(and(eq(oauthCodes.hash, row.code.hash), isNull(oauthCodes.usedAt)))
    .returning({ hash: oauthCodes.hash });
  if (!claimed) {
    await revokeGrant(row.grant.id, now);
    throw new OAuthError("invalid_grant", "The authorization code has already been used.");
  }
  return issueTokens(row.grant, now);
}

/** Rotates the refresh token. Reusing an old one revokes the grant, since it may have leaked. */
export async function exchangeRefresh(
  args: { token: string; clientId: string; resource: string | null; origin: string },
  now = new Date(),
) {
  const invalid = new OAuthError("invalid_grant", "The refresh token is expired, revoked or already used.");
  if (!args.token.startsWith(REFRESH_TOKEN_PREFIX)) throw invalid;
  const [row] = await db
    .select({ token: oauthTokens, grant: oauthGrants })
    .from(oauthTokens)
    .innerJoin(oauthGrants, eq(oauthGrants.id, oauthTokens.grantId))
    .where(and(eq(oauthTokens.hash, digest(args.token)), eq(oauthTokens.kind, "refresh")))
    .limit(1);
  if (!row || row.token.expiresAt.getTime() <= now.getTime() || !grantUsable(row.grant, args.clientId, now)) throw invalid;
  if (!resourceMatches(row.grant, args.resource, args.origin)) throw invalid;
  const [claimed] = await db
    .update(oauthTokens)
    .set({ usedAt: now })
    .where(and(eq(oauthTokens.hash, row.token.hash), isNull(oauthTokens.usedAt)))
    .returning({ hash: oauthTokens.hash });
  if (!claimed) {
    await revokeGrant(row.grant.id, now);
    throw invalid;
  }
  return issueTokens(row.grant, now);
}

/** RFC 7009: revokes the grant behind an access or refresh token. Unknown tokens are not an error. */
export async function revokeToken(token: string, clientId: string, now = new Date()) {
  const [row] = await db
    .select({ grantId: oauthGrants.id })
    .from(oauthTokens)
    .innerJoin(oauthGrants, eq(oauthGrants.id, oauthTokens.grantId))
    .where(and(eq(oauthTokens.hash, digest(token)), eq(oauthGrants.clientId, clientId)))
    .limit(1);
  if (row) await revokeGrant(row.grantId, now);
}

export type OAuthCaller = { userId: string; grantId: string; clientId: string; service: string | null; expiresAt: Date };

/**
 * Resolves an access token for a request to `pathname`. A token for the
 * all-services endpoint works on every endpoint; a single-service token only
 * on its own.
 */
export async function authenticateAccessToken(token: string, pathname: string, now = new Date()): Promise<OAuthCaller | null> {
  if (!token.startsWith(ACCESS_TOKEN_PREFIX) || token.length > 200) return null;
  const endpoint = parseMcpPath(pathname);
  if (!endpoint) return null;
  const [row] = await db
    .select({ grant: oauthGrants, expiresAt: oauthTokens.expiresAt })
    .from(oauthTokens)
    .innerJoin(oauthGrants, eq(oauthGrants.id, oauthTokens.grantId))
    .where(
      and(
        eq(oauthTokens.hash, digest(token)),
        eq(oauthTokens.kind, "access"),
        gt(oauthTokens.expiresAt, now),
        gt(oauthGrants.expiresAt, now),
        isNull(oauthGrants.revokedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  if (row.grant.service && row.grant.service !== endpoint.service) return null;
  if (shouldTouchLastUsed(row.grant.lastUsedAt, now)) {
    void db
      .update(oauthGrants)
      .set({ lastUsedAt: now })
      .where(eq(oauthGrants.id, row.grant.id))
      .catch((error) => console.error("[oauth] failed to update lastUsedAt", error));
  }
  return { userId: row.grant.userId, grantId: row.grant.id, clientId: row.grant.clientId, service: row.grant.service, expiresAt: row.expiresAt };
}

/** Drops expired codes and tokens, and grants that expired or were revoked (their tokens cascade). */
export async function cleanupOAuth(now = new Date()) {
  await db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, now));
  await db.delete(oauthTokens).where(lt(oauthTokens.expiresAt, now));
  await db.delete(oauthGrants).where(or(lt(oauthGrants.expiresAt, now), isNotNull(oauthGrants.revokedAt)));
}
