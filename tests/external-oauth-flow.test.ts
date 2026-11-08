import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { auth } from "@ai-sdk/mcp";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db, externalMcpClients } from "@/db";
import { seal } from "@/lib/sealed";
import { connectionFor, oauthProvider } from "@/lib/external-mcp/provider";
import { GET } from "@/app/api/external-mcp/callback/route";

const state = vi.hoisted(() => ({ userId: "alice", challenge: "", refreshCalls: 0 }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => state.userId ? { id: state.userId } : null }));
vi.mock("@/lib/external-mcp/safe-fetch", () => ({
  assertPublicUrl: async (url: string | URL) => new URL(url),
  externalFetch: async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.pathname.includes("oauth-protected-resource")) return Response.json({ resource: "https://mcp.example.test/mcp", authorization_servers: ["https://auth.example.test"] });
    if (url.pathname.includes("oauth-authorization-server")) return Response.json({ issuer: "https://auth.example.test", authorization_endpoint: "https://auth.example.test/authorize", token_endpoint: "https://auth.example.test/token", registration_endpoint: "https://auth.example.test/register", response_types_supported: ["code"], code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["none"] });
    if (url.pathname === "/register") return Response.json({ client_id: "registered-client", redirect_uris: ["https://app.test/api/external-mcp/callback"] }, { status: 201 });
    if (url.pathname === "/token") {
      const params = new URLSearchParams(await request.text());
      if (params.get("grant_type") === "refresh_token") { state.refreshCalls++; return Response.json({ access_token: "rotated-access", refresh_token: "rotated-refresh", token_type: "Bearer" }); }
      expect(params.get("client_id")).toBe("registered-client");
      expect(createHash("sha256").update(params.get("code_verifier")!).digest("base64url")).toBe(state.challenge);
      return Response.json({ access_token: "initial-access", refresh_token: "initial-refresh", token_type: "Bearer" });
    }
    throw new Error(`Unexpected fixture URL ${url}`);
  },
}));
beforeAll(async () => { await migrate(db, { migrationsFolder: "db/migrations" }); process.env.AUTH_SECRET = "oauth-flow-fixture-only"; });

async function start() {
  const id = crypto.randomUUID();
  await db.insert(externalMcpClients).values({ id, userId: "alice", name: "Fixture", url: "https://mcp.example.test/mcp", redirectUri: "https://app.test/api/external-mcp/callback", credentials: seal("external-mcp", "{}") });
  const session = oauthProvider(await connectionFor("alice", id), true);
  expect(await auth(session.provider, { serverUrl: "https://mcp.example.test/mcp", fetchFn: session.fetch })).toBe("REDIRECT");
  const authorization = new URL(session.authorizationUrl()!);
  expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
  state.challenge = authorization.searchParams.get("code_challenge")!;
  const callback = new URL("https://app.test/api/external-mcp/callback");
  callback.search = new URLSearchParams({ code: "fixture-code", state: authorization.searchParams.get("state")!, iss: "https://auth.example.test" }).toString();
  return { id, callback };
}

describe("MCP OAuth round trip with provider fixtures", () => {
  it("registers, authorizes with PKCE, consumes callback state and rotates refresh tokens", async () => {
    const { id, callback } = await start();
    const response = await GET(new Request(callback));
    expect(response.headers.get("location")).toBe("https://app.test/mcp-clients?status=connected");
    expect((await connectionFor("alice", id)).connected).toBe(true);
    expect((await GET(new Request(callback))).headers.get("location")).toContain("status=failed");
    const row = await connectionFor("alice", id);
    const first = oauthProvider(row);
    const second = oauthProvider(row);
    const results = await Promise.allSettled([auth(first.provider, { serverUrl: row.url, fetchFn: first.fetch }), auth(second.provider, { serverUrl: row.url, fetchFn: second.fetch })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(state.refreshCalls).toBe(1);
    const restored = oauthProvider(await connectionFor("alice", id)).provider;
    expect(await restored.tokens()).toMatchObject({ access_token: "rotated-access", refresh_token: "rotated-refresh" });
  });
  it("rejects another account, missing sessions and mismatched issuer without connecting", async () => {
    const { id, callback } = await start();
    state.userId = "bob";
    expect((await GET(new Request(callback))).headers.get("location")).toContain("status=failed");
    state.userId = "";
    expect((await GET(new Request(callback))).status).toBe(401);
    state.userId = "alice";
    callback.searchParams.set("iss", "https://attacker.test");
    expect((await GET(new Request(callback))).headers.get("location")).toContain("status=failed");
    expect((await connectionFor("alice", id)).connected).toBe(false);
  });
});
