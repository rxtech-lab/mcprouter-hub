import "server-only";
import { createMCPClient } from "@ai-sdk/mcp";
import { and, eq, sql } from "drizzle-orm";
import { db, externalMcpClients } from "@/db";
import { connectionFor, oauthProvider } from "./provider";
import { externalFetch } from "./safe-fetch";

export const TOOLS_CACHE_TTL_MS = 2 * 60 * 60 * 1000;

/** Inspect definitions only; opening a connection must never execute its tools. */
export async function clientTools(userId: string, id: string, reload = false) {
  let row = await connectionFor(userId, id);
  if (!row.connected) return { tools: [], error: "Reconnect this MCP client to view its tools." };
  if (reload) {
    // A generation prevents an older in-flight load from overwriting a reload.
    const [updated] = await db.update(externalMcpClients).set({ toolsCacheVersion: sql`${externalMcpClients.toolsCacheVersion} + 1` })
      .where(and(eq(externalMcpClients.userId, userId), eq(externalMcpClients.id, id), eq(externalMcpClients.connected, true))).returning();
    if (!updated) throw new Error("NOT_FOUND");
    row = updated;
  }
  const age = row.toolsCache ? Date.now() - row.toolsCache.fetchedAt : Infinity;
  if (!reload && row.toolsCache && age >= 0 && age < TOOLS_CACHE_TTL_MS) return { tools: row.toolsCache.tools };
  try {
    const session = oauthProvider(row);
    const signal = AbortSignal.timeout(15_000);
    const client = await createMCPClient({
      transport: { type: "http", url: row.url, authProvider: session.provider, fetch: session.fetch },
      initializationOptions: { signal },
    });
    try {
      const tools: { name: string; title?: string; description?: string }[] = [];
      const cursors = new Set<string>();
      let cursor: string | undefined;
      do {
        const page = await client.listTools({ params: { cursor }, options: { signal } });
        tools.push(...page.tools.map(({ name, title, description }) => ({ name, title, description })));
        cursor = page.nextCursor;
        if (cursor && cursors.has(cursor)) throw new Error("Repeated tools cursor");
        if (cursor) cursors.add(cursor);
      } while (cursor);
      await db.update(externalMcpClients).set({ toolsCache: { tools, fetchedAt: Date.now() } }).where(and(
        eq(externalMcpClients.id, id), eq(externalMcpClients.userId, userId),
        eq(externalMcpClients.connected, true), eq(externalMcpClients.toolsCacheVersion, row.toolsCacheVersion),
      ));
      return { tools };
    } finally {
      await client.close().catch(() => {});
    }
  } catch {
    return { tools: [], error: "Could not load tools. Try again or reconnect this MCP client." };
  }
}

export async function clientAccount(userId: string, id: string) {
  const row = await connectionFor(userId, id);
  if (!row.connected) return { message: "Reconnect this MCP client to view its connected account." };
  try {
    const { provider } = oauthProvider(row);
    const server = await provider.authorizationServerInformation?.();
    const tokens = await provider.tokens();
    const issuer = server?.issuer ?? server?.authorizationServerUrl;
    if (!issuer || !tokens) return { message: "This provider does not share connected account details." };
    const base = new URL(issuer);
    const signal = AbortSignal.timeout(10_000);
    const response = await externalFetch(`${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`, { signal, cache: "no-store" });
    if (!response.ok) return { message: "This provider does not share connected account details." };
    const metadata = await response.json();
    // Only send the token to the pinned issuer's advertised, same-origin endpoint.
    if (metadata.issuer !== issuer || typeof metadata.userinfo_endpoint !== "string" || new URL(metadata.userinfo_endpoint).origin !== base.origin) {
      return { message: "This provider does not share connected account details." };
    }
    const info = await externalFetch(metadata.userinfo_endpoint, { headers: { Authorization: `Bearer ${tokens.access_token}` }, signal, cache: "no-store" });
    if (!info.ok) return { message: "Account details are unavailable. Try reconnecting this MCP client." };
    const claims = await info.json();
    const text = (value: unknown) => typeof value === "string" && value.trim() ? value.slice(0, 500) : undefined;
    const account = { name: text(claims.name) ?? text(claims.preferred_username), email: text(claims.email), subject: text(claims.sub) };
    if (!account.subject) return { message: "This provider does not share connected account details." };
    return { account };
  } catch {
    return { message: "Account details are unavailable. Try again or reconnect this MCP client." };
  }
}
