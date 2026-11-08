import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq, sql } from "drizzle-orm";
import { db, externalMcpClients } from "@/db";
const mocks = vi.hoisted(() => ({ listTools: vi.fn(), close: vi.fn(), createMCPClient: vi.fn() }));
vi.mock("@ai-sdk/mcp", () => ({ createMCPClient: mocks.createMCPClient }));
vi.mock("@/lib/external-mcp/provider", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/external-mcp/provider")>(),
  oauthProvider: () => ({ provider: {}, fetch: vi.fn() }),
}));
import { clientTools, TOOLS_CACHE_TTL_MS } from "@/lib/external-mcp/details";
import { connectionFor } from "@/lib/external-mcp/provider";
const initial = [{ name: "initial", description: "Initial tool" }];
const fresh = [{ name: "fresh" }];
beforeAll(async () => { await migrate(db, { migrationsFolder: "db/migrations" }); });
beforeEach(async () => {
  vi.resetAllMocks();
  await db.delete(externalMcpClients);
  await db.insert(externalMcpClients).values({ id: "connection", userId: "alice", name: "Test", url: "https://example.com/mcp", redirectUri: "https://app.test/callback", credentials: "sealed", connected: true });
  mocks.close.mockResolvedValue(undefined);
  mocks.listTools.mockResolvedValue({ tools: initial });
  mocks.createMCPClient.mockResolvedValue({ listTools: mocks.listTools, close: mocks.close });
});
async function cache(tools = initial, fetchedAt = Date.now()) {
  await db.update(externalMcpClients).set({ toolsCache: { tools, fetchedAt } }).where(eq(externalMcpClients.id, "connection"));
}

describe("persistent MCP tools cache", () => {
  it("stores successful loads and serves subsequent visits without contacting MCP", async () => {
    expect(await clientTools("alice", "connection")).toEqual({ tools: initial });
    const row = await connectionFor("alice", "connection");
    expect(row.toolsCache?.tools).toEqual(initial);
    expect(row.toolsCache?.fetchedAt).toBeGreaterThan(Date.now() - 1000);
    expect(await clientTools("alice", "connection")).toEqual({ tools: initial });
    expect(mocks.createMCPClient).toHaveBeenCalledOnce();
  });
  it("uses a persisted cache for the full two hours then blocks for fresh tools", async () => {
    const loadedAt = Date.now() - TOOLS_CACHE_TTL_MS;
    await cache(initial, loadedAt);
    const now = vi.spyOn(Date, "now").mockReturnValue(loadedAt + TOOLS_CACHE_TTL_MS - 1);
    try {
      expect(await clientTools("alice", "connection")).toEqual({ tools: initial });
      expect(mocks.createMCPClient).not.toHaveBeenCalled();
      now.mockReturnValue(loadedAt + TOOLS_CACHE_TTL_MS);
      mocks.listTools.mockResolvedValue({ tools: fresh });
      expect(await clientTools("alice", "connection")).toEqual({ tools: fresh });
      expect(mocks.createMCPClient).toHaveBeenCalledOnce();
      expect((await connectionFor("alice", "connection")).toolsCache?.fetchedAt).toBe(loadedAt + TOOLS_CACHE_TTL_MS);
    } finally { now.mockRestore(); }
  });
  it("caches an empty tool list", async () => {
    await cache([]);
    expect(await clientTools("alice", "connection")).toEqual({ tools: [] });
    expect(mocks.createMCPClient).not.toHaveBeenCalled();
  });
  it("manual reload bypasses fresh cache and replaces it", async () => {
    await cache();
    mocks.listTools.mockResolvedValue({ tools: fresh });
    expect(await clientTools("alice", "connection", true)).toEqual({ tools: fresh });
    expect(await clientTools("alice", "connection")).toEqual({ tools: fresh });
    expect(mocks.createMCPClient).toHaveBeenCalledOnce();
    expect((await connectionFor("alice", "connection")).toolsCacheVersion).toBe(1);
  });
  it("keeps a good cache on reload failure and does not cache failures", async () => {
    await cache();
    mocks.listTools.mockRejectedValue(new Error("offline"));
    expect((await clientTools("alice", "connection", true)).error).toBeTruthy();
    expect((await connectionFor("alice", "connection")).toolsCache?.tools).toEqual(initial);
    await cache(initial, Date.now() - TOOLS_CACHE_TTL_MS);
    expect((await clientTools("alice", "connection")).error).toBeTruthy();
    expect((await clientTools("alice", "connection")).error).toBeTruthy();
    expect(mocks.listTools).toHaveBeenCalledTimes(3);
  });
  it("checks ownership and connected state even on cache hits and manual reloads", async () => {
    await cache();
    await expect(clientTools("bob", "connection")).rejects.toThrow("NOT_FOUND");
    await expect(clientTools("bob", "connection", true)).rejects.toThrow("NOT_FOUND");
    await db.update(externalMcpClients).set({ connected: false }).where(eq(externalMcpClients.id, "connection"));
    expect((await clientTools("alice", "connection")).error).toContain("Reconnect");
    expect((await clientTools("alice", "connection", true)).error).toContain("Reconnect");
    expect(mocks.createMCPClient).not.toHaveBeenCalled();
  });
  it("does not let an older load overwrite a manual reload", async () => {
    let complete!: (result: { tools: typeof initial }) => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    mocks.listTools.mockImplementationOnce(() => { started(); return new Promise((resolve) => { complete = resolve; }); })
      .mockResolvedValueOnce({ tools: fresh });
    const older = clientTools("alice", "connection");
    await ready;
    await clientTools("alice", "connection", true);
    complete({ tools: initial });
    await older;
    expect((await connectionFor("alice", "connection")).toolsCache?.tools).toEqual(fresh);
  });
  it("does not restore a cache invalidated by reconnect during a load", async () => {
    mocks.listTools.mockImplementationOnce(async () => {
      await db.update(externalMcpClients).set({ toolsCache: null, toolsCacheVersion: sql`${externalMcpClients.toolsCacheVersion} + 1` }).where(eq(externalMcpClients.id, "connection"));
      return { tools: initial };
    });
    await clientTools("alice", "connection");
    expect((await connectionFor("alice", "connection")).toolsCache).toBeNull();
  });
});
