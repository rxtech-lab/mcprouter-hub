import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db, externalMcpClients } from "@/db";
import { seal } from "@/lib/sealed";
import { connectionFor, oauthProvider } from "@/lib/external-mcp/provider";
import { externalServers } from "@/lib/external-mcp/servers";
import { assertPublicUrl, publicAddress } from "@/lib/external-mcp/safe-fetch";

beforeAll(async () => { await migrate(db, { migrationsFolder: "db/migrations" }); process.env.AUTH_SECRET = "test-secret-not-used-in-production"; });
async function connection(userId = "alice") {
  const row = { id: crypto.randomUUID(), userId, name: "External", url: "https://example.com/mcp", redirectUri: "https://app.test/api/external-mcp/callback", credentials: seal("external-mcp", "{}") };
  await db.insert(externalMcpClients).values(row);
  return connectionFor(userId, row.id);
}

describe("outbound OAuth credential storage", () => {
  it("seals tokens, preserves rotated refresh credentials and scopes clients to the owner", async () => {
    const row = await connection();
    const { provider } = oauthProvider(row);
    await provider.saveTokens({ access_token: "access-secret", refresh_token: "refresh-secret", token_type: "Bearer" });
    await provider.saveTokens({ access_token: "new-secret", token_type: "Bearer" });
    const stored = await connectionFor("alice", row.id);
    expect(stored.credentials).not.toContain("secret");
    expect(await oauthProvider(stored).provider.tokens()).toMatchObject({ access_token: "new-secret", refresh_token: "refresh-secret" });
    await expect(connectionFor("bob", row.id)).rejects.toThrow("NOT_FOUND");
    expect(await externalServers("bob")).toEqual([]);
    expect(await externalServers("alice")).toEqual([]); // not authorized yet
  });
  it("persists OAuth state with an expiry, PKCE verifier and AS pin", async () => {
    const row = await connection();
    const { provider } = oauthProvider(row, true);
    const state = await provider.state!();
    await provider.saveState!(state);
    await provider.saveCodeVerifier("pkce-secret");
    await provider.saveAuthorizationServerInformation!({ issuer: "https://auth.test", authorizationServerUrl: "https://auth.test", tokenEndpoint: "https://auth.test/token" });
    const stored = await connectionFor("alice", row.id);
    expect(stored.stateHash).toBeTruthy();
    expect(stored.stateHash).not.toBe(state);
    expect(stored.stateExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    const restored = oauthProvider(stored).provider;
    expect(await restored.storedState!()).toBe(state);
    expect(await restored.codeVerifier()).toBe("pkce-secret");
    expect(await restored.authorizationServerInformation!()).toMatchObject({ issuer: "https://auth.test" });
  });
  it("refuses stale writers instead of replacing a newer refresh token", async () => {
    const row = await connection();
    const first = oauthProvider(row).provider;
    const stale = oauthProvider(row).provider;
    await first.saveTokens({ access_token: "latest", token_type: "Bearer" });
    await expect(stale.saveTokens({ access_token: "stale", token_type: "Bearer" })).rejects.toThrow("Connection changed");
  });
});

describe("public endpoint boundary", () => {
  it("rejects private and mapped addresses, alternate schemes, credentials and ports", async () => {
    for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "172.16.1.2", "192.168.0.1", "100.64.1.2", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1"]) expect(publicAddress(address)).toBe(false);
    expect(publicAddress("8.8.8.8")).toBe(true);
    expect(publicAddress("2606:4700:4700::1111")).toBe(true);
    for (const url of ["http://example.com", "https://127.0.0.1", "https://[::1]", "https://user:secret@example.com", "https://example.com:8443"]) await expect(assertPublicUrl(url)).rejects.toThrow();
  });
});
