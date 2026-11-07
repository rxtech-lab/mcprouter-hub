import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "@/db";

const mocks = vi.hoisted(() => ({
  connectionFor: vi.fn(), oauthProvider: vi.fn(), createMCPClient: vi.fn(), externalFetch: vi.fn(),
  listTools: vi.fn(), close: vi.fn(),
}));
vi.mock("@/lib/external-mcp/provider", () => ({ connectionFor: mocks.connectionFor, oauthProvider: mocks.oauthProvider }));
vi.mock("@/lib/external-mcp/safe-fetch", () => ({ externalFetch: mocks.externalFetch }));
vi.mock("@ai-sdk/mcp", () => ({ createMCPClient: mocks.createMCPClient }));
import { clientAccount, clientTools } from "@/lib/external-mcp/details";

beforeAll(async () => { await migrate(db, { migrationsFolder: "db/migrations" }); });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.connectionFor.mockResolvedValue({ connected: true, url: "https://mcp.test/mcp", toolsCacheVersion: 0 });
  mocks.oauthProvider.mockReturnValue({ provider: {
    tokens: () => ({ access_token: "private-access-token", refresh_token: "private-refresh-token" }),
    authorizationServerInformation: () => ({ issuer: "https://auth.test", authorizationServerUrl: "https://auth.test" }),
  } });
  mocks.close.mockResolvedValue(undefined);
  mocks.createMCPClient.mockResolvedValue({ listTools: mocks.listTools, close: mocks.close });
});

describe("MCP connection inspection", () => {
  it("lists every page without exposing schemas or credentials and closes the client", async () => {
    mocks.listTools.mockResolvedValueOnce({ tools: [{ name: "first", description: "First tool", inputSchema: { secret: true } }], nextCursor: "next" })
      .mockResolvedValueOnce({ tools: [{ name: "second", title: "Second tool" }] });
    expect(await clientTools("alice", "connection-id")).toEqual({ tools: [{ name: "first", description: "First tool" }, { name: "second", title: "Second tool" }] });
    expect(mocks.connectionFor).toHaveBeenCalledWith("alice", "connection-id");
    expect(mocks.listTools.mock.calls[1][0].params.cursor).toBe("next");
    expect(mocks.close).toHaveBeenCalledOnce();
  });
  it("closes on listing failure and hides provider errors", async () => {
    mocks.listTools.mockRejectedValue(new Error("private-access-token"));
    const result = await clientTools("alice", "id");
    expect(result.error).toContain("Could not load tools");
    expect(JSON.stringify(result)).not.toContain("private-access-token");
    expect(mocks.close).toHaveBeenCalledOnce();
  });
  it("rejects looping pagination", async () => {
    mocks.listTools.mockResolvedValue({ tools: [], nextCursor: "same" });
    expect((await clientTools("alice", "id")).error).toBeTruthy();
    expect(mocks.listTools).toHaveBeenCalledTimes(2);
  });
  it("does not contact disconnected servers", async () => {
    mocks.connectionFor.mockResolvedValue({ connected: false });
    expect((await clientTools("alice", "id")).error).toContain("Reconnect");
    expect((await clientAccount("alice", "id")).message).toContain("Reconnect");
    expect(mocks.createMCPClient).not.toHaveBeenCalled();
    expect(mocks.externalFetch).not.toHaveBeenCalled();
  });
  it("requires ownership before any network access", async () => {
    mocks.connectionFor.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(clientTools("bob", "id")).rejects.toThrow("NOT_FOUND");
    await expect(clientAccount("bob", "id")).rejects.toThrow("NOT_FOUND");
    expect(mocks.externalFetch).not.toHaveBeenCalled();
  });
  it("returns only allowlisted account fields from the pinned provider", async () => {
    mocks.externalFetch.mockResolvedValueOnce(Response.json({ issuer: "https://auth.test", userinfo_endpoint: "https://auth.test/userinfo" }))
      .mockResolvedValueOnce(Response.json({ sub: "user-123", name: "Alex", email: "alex@example.com", access_token: "secret", admin: true }));
    expect(await clientAccount("alice", "id")).toEqual({ account: { subject: "user-123", name: "Alex", email: "alex@example.com" } });
    expect(mocks.externalFetch.mock.calls[1][1].headers.Authorization).toBe("Bearer private-access-token");
  });
  it.each([
    { issuer: "https://other.test", userinfo_endpoint: "https://auth.test/userinfo" },
    { issuer: "https://auth.test", userinfo_endpoint: "https://other.test/userinfo" },
    { issuer: "https://auth.test" },
  ])("does not send tokens to untrusted or missing endpoints", async (metadata) => {
    mocks.externalFetch.mockResolvedValueOnce(Response.json(metadata));
    expect((await clientAccount("alice", "id")).message).toContain("does not share");
    expect(mocks.externalFetch).toHaveBeenCalledOnce();
  });
  it("handles providers without discovery or expired account access", async () => {
    mocks.externalFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect((await clientAccount("alice", "id")).message).toContain("does not share");
    mocks.externalFetch.mockResolvedValueOnce(Response.json({ issuer: "https://auth.test", userinfo_endpoint: "https://auth.test/userinfo" }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    expect((await clientAccount("alice", "id")).message).toContain("reconnecting");
  });
});
