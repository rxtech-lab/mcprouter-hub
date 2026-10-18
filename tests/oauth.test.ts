import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import {
  ACCESS_TOKEN_PREFIX,
  approveAuthorization,
  authenticateAccessToken,
  checkAuthorizationRequest,
  clientRedirect,
  exchangeCode,
  exchangeRefresh,
  isValidRedirectUri,
  OAuthError,
  pkceChallenge,
  protectedResourceMetadata,
  redirectUriMatches,
  registerClient,
  resolveResource,
  revokeToken,
  secret,
} from "@/lib/mcp/oauth";
import { verifyMcpToken } from "@/lib/mcp/handler";

const origin = "https://hub.example";
const redirectUri = "http://127.0.0.1:33418/callback";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
});

async function authorize(userId: string, resource?: string) {
  const client = await registerClient({ client_name: "Test agent", redirect_uris: [redirectUri] });
  const verifier = secret();
  const check = await checkAuthorizationRequest(
    {
      response_type: "code",
      client_id: client.client_id,
      redirect_uri: redirectUri,
      code_challenge: pkceChallenge(verifier),
      code_challenge_method: "S256",
      state: "xyz",
      resource,
    },
    origin,
  );
  if (!check.ok) throw new Error(check.message);
  const code = await approveAuthorization(userId, check.request);
  return { client, verifier, code };
}

const rejects = (promise: Promise<unknown>, code: string) =>
  expect(promise).rejects.toSatisfy((error) => error instanceof OAuthError && error.code === code);

describe("OAuth for MCP", () => {
  it("accepts HTTPS, loopback and app-scheme redirects only", () => {
    expect(isValidRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(isValidRedirectUri("http://localhost:5555/cb")).toBe(true);
    expect(isValidRedirectUri("cursor://anysphere.cursor-mcp/oauth/callback")).toBe(true);
    expect(isValidRedirectUri("http://evil.example/cb")).toBe(false);
    expect(isValidRedirectUri("javascript:alert(1)")).toBe(false);
    expect(isValidRedirectUri("https://a.example/cb#frag")).toBe(false);
    // Loopback clients pick a port at runtime.
    expect(redirectUriMatches(["http://127.0.0.1:1000/cb"], "http://127.0.0.1:2000/cb")).toBe(true);
    expect(redirectUriMatches(["http://127.0.0.1:1000/cb"], "http://127.0.0.1:2000/other")).toBe(false);
    expect(redirectUriMatches(["https://a.example/cb"], "https://a.example/cb2")).toBe(false);
  });

  it("binds resources to this origin's MCP endpoints", () => {
    expect(resolveResource(undefined, origin)).toEqual({ url: `${origin}/api/mcp/streamable`, service: null });
    expect(resolveResource(`${origin}/api/mcp/s/kmb/streamable`, origin)).toEqual({ url: `${origin}/api/mcp/s/kmb/streamable`, service: "kmb" });
    expect(() => resolveResource("https://other.example/api/mcp/streamable", origin)).toThrow(OAuthError);
    expect(() => resolveResource(`${origin}/api/mcp/s/nope/streamable`, origin)).toThrow(OAuthError);
    expect(protectedResourceMetadata(origin, "/api/mcp/s/kmb/streamable")).toMatchObject({ resource: `${origin}/api/mcp/s/kmb/streamable`, authorization_servers: [origin] });
    expect(protectedResourceMetadata(origin, "/").resource).toBe(`${origin}/api/mcp/streamable`);
  });

  it("shows untrusted client errors instead of redirecting, and redirects the rest", async () => {
    const unknown = await checkAuthorizationRequest({ client_id: "nope", redirect_uri: redirectUri }, origin);
    expect(unknown).toMatchObject({ ok: false, redirectUri: null });

    const client = await registerClient({ redirect_uris: [redirectUri] });
    const wrongUri = await checkAuthorizationRequest({ client_id: client.client_id, redirect_uri: "https://evil.example/cb" }, origin);
    expect(wrongUri).toMatchObject({ ok: false, redirectUri: null });

    const noPkce = await checkAuthorizationRequest({ client_id: client.client_id, redirect_uri: redirectUri, response_type: "code", state: "s" }, origin);
    expect(noPkce).toMatchObject({ ok: false, redirectUri, error: "invalid_request", state: "s" });
    expect(clientRedirect(redirectUri, { code: "c" }, "s", origin)).toBe(`${redirectUri}?code=c&state=s&iss=${encodeURIComponent(origin)}`);
  });

  it("exchanges a code once with the right PKCE verifier, then authenticates MCP calls", async () => {
    const { client, verifier, code } = await authorize("alice");
    const base = { code, clientId: client.client_id, redirectUri, resource: null, origin };
    await rejects(exchangeCode({ ...base, verifier: secret() }), "invalid_grant");
    await rejects(exchangeCode({ ...base, verifier, redirectUri: "http://127.0.0.1:1/other" }), "invalid_grant");

    const tokens = await exchangeCode({ ...base, verifier });
    expect(tokens.access_token.startsWith(ACCESS_TOKEN_PREFIX)).toBe(true);
    expect(tokens).toMatchObject({ token_type: "Bearer", scope: "mcp" });

    const caller = await authenticateAccessToken(tokens.access_token, "/api/mcp/s/kmb/streamable");
    expect(caller?.userId).toBe("alice");

    const request = new Request(`${origin}/api/mcp/streamable`);
    const auth = await verifyMcpToken(request, tokens.access_token);
    expect(auth?.extra).toMatchObject({ userId: "alice", apiKeyId: null, scopes: [] });
    // OAuth tokens aren't accepted from the query string.
    expect(await verifyMcpToken(new Request(`${origin}/api/mcp/streamable?token=${tokens.access_token}`))).toBeUndefined();

    // Replaying the code revokes the grant and every token issued from it.
    await rejects(exchangeCode({ ...base, verifier }), "invalid_grant");
    expect(await authenticateAccessToken(tokens.access_token, "/api/mcp/streamable")).toBeNull();
  });

  it("limits single-service grants to their endpoint", async () => {
    const { client, verifier, code } = await authorize("bob", `${origin}/api/mcp/s/kmb/streamable`);
    const tokens = await exchangeCode({ code, clientId: client.client_id, redirectUri, verifier, resource: `${origin}/api/mcp/s/kmb/streamable`, origin });
    expect(await authenticateAccessToken(tokens.access_token, "/api/mcp/s/kmb/streamable")).toMatchObject({ service: "kmb" });
    expect(await authenticateAccessToken(tokens.access_token, "/api/mcp/streamable")).toBeNull();
    expect(await authenticateAccessToken(tokens.access_token, "/api/mcp/s/mtr/streamable")).toBeNull();
    const auth = await verifyMcpToken(new Request(`${origin}/api/mcp/s/kmb/streamable`), tokens.access_token);
    expect(auth?.extra).toMatchObject({ scopes: ["kmb"] });
  });

  it("rotates refresh tokens and revokes the grant on reuse", async () => {
    const { client, verifier, code } = await authorize("carol");
    const first = await exchangeCode({ code, clientId: client.client_id, redirectUri, verifier, resource: null, origin });
    const refresh = { clientId: client.client_id, resource: null, origin };

    await rejects(exchangeRefresh({ ...refresh, clientId: "someone-else", token: first.refresh_token }), "invalid_grant");
    const second = await exchangeRefresh({ ...refresh, token: first.refresh_token });
    expect(second.refresh_token).not.toBe(first.refresh_token);
    expect(await authenticateAccessToken(second.access_token, "/api/mcp/streamable")).not.toBeNull();

    await rejects(exchangeRefresh({ ...refresh, token: first.refresh_token }), "invalid_grant");
    expect(await authenticateAccessToken(second.access_token, "/api/mcp/streamable")).toBeNull();
    await rejects(exchangeRefresh({ ...refresh, token: second.refresh_token }), "invalid_grant");
  });

  it("revokes the grant from either token", async () => {
    const { client, verifier, code } = await authorize("dave");
    const tokens = await exchangeCode({ code, clientId: client.client_id, redirectUri, verifier, resource: null, origin });
    await revokeToken(tokens.refresh_token, "another-client");
    expect(await authenticateAccessToken(tokens.access_token, "/api/mcp/streamable")).not.toBeNull();
    await revokeToken(tokens.refresh_token, client.client_id);
    expect(await authenticateAccessToken(tokens.access_token, "/api/mcp/streamable")).toBeNull();
  });

  it("rejects expired access tokens", async () => {
    const { client, verifier, code } = await authorize("erin");
    const tokens = await exchangeCode({ code, clientId: client.client_id, redirectUri, verifier, resource: null, origin });
    expect(await authenticateAccessToken(tokens.access_token, "/api/mcp/streamable", new Date(Date.now() + 2 * 3600_000))).toBeNull();
  });
});
