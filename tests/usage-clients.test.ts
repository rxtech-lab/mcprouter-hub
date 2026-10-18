import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { apiKeys, oauthClients, toolCalls } from "@/db/schema";
import type { AppUser } from "@/lib/auth";
import { callsByClient, callsByTool, clientUsage, parseClientId } from "@/lib/usage";

const user: AppUser = { id: "usage-user", name: "Usage", email: "usage@test", roles: [] };
const base = { userId: user.id, service: "hko-weather", latencyMs: 100 } as const;

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
  await db.insert(apiKeys).values({ id: "key-a", userId: user.id, name: "Laptop", prefix: "mcpr_ab", hash: "hash-a" });
  await db.insert(oauthClients).values({ id: "client-a", name: "Claude", redirectUris: [] });
  await db.insert(toolCalls).values([
    { ...base, tool: "current", status: "ok", apiKeyId: "key-a", channel: "key" },
    { ...base, tool: "current", status: "error", apiKeyId: "key-a", channel: "key" },
    // Logged before channels were recorded.
    { ...base, tool: "forecast", status: "ok", apiKeyId: "key-a" },
    { ...base, tool: "forecast", status: "ok" },
    { ...base, tool: "current", status: "ok", channel: "oauth", oauthClientId: "client-a" },
    { ...base, tool: "current", status: "ok", channel: "telegram" },
    { ...base, tool: "warnings", status: "ok", channel: "telegram", latencyMs: 300 },
    { ...base, tool: "current", status: "denied", channel: "whatsapp" },
    { ...base, tool: "current", status: "ok", channel: "web" },
    { ...base, userId: "someone-else", tool: "current", status: "ok", channel: "telegram" },
  ]);
});

describe("usage by client", () => {
  it("groups calls by key, connected app and agent channel, busiest first", async () => {
    const clients = await callsByClient(user, 7);
    const summary = clients.map(({ id, label, calls, errors }) => ({ id, label, calls, errors }));
    // Ties keep no particular order, so only the two busiest are checked in place.
    expect(summary.slice(0, 2)).toEqual([
      { id: "key:key-a", label: "Laptop (mcpr_ab…)", calls: 3, errors: 1 },
      { id: "telegram", label: "Telegram", calls: 2, errors: 0 },
    ]);
    expect(summary.slice(2)).toEqual(
      expect.arrayContaining([
        { id: "agent", label: "Agent (before channels were tracked)", calls: 1, errors: 0 },
        { id: "oauth:client-a", label: "Claude", calls: 1, errors: 0 },
        { id: "web", label: "Web chat", calls: 1, errors: 0 },
        { id: "whatsapp", label: "WhatsApp", calls: 1, errors: 1 },
      ]),
    );
    expect(summary).toHaveLength(6);
  });

  it("shows one client's daily calls, totals and tools", async () => {
    const detail = await clientUsage(user, "telegram", 7);
    expect(detail).toMatchObject({ label: "Telegram", calls: 2, errors: 0, averageLatencyMs: 200 });
    expect(detail.daily).toHaveLength(7);
    expect(detail.daily.at(-1)?.value).toBe(2);
    const breakdown = await callsByTool(user, 7, "telegram");
    expect(breakdown.byTool.map((row) => row.tool).sort()).toEqual(["current", "warnings"]);
  });

  it("only accepts known client ids from the URL", () => {
    expect(parseClientId("telegram")).toBe("telegram");
    expect(parseClientId("key:abc")).toBe("key:abc");
    expect(parseClientId("toString")).toBeNull();
    expect(parseClientId("free")).toBeNull();
  });
});
