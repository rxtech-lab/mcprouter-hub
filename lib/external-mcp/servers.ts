import "server-only";
import { and, eq } from "drizzle-orm";
import { db, externalMcpClients } from "@/db";
import { oauthProvider } from "./provider";

export async function externalServers(userId: string) {
  const rows = await db.select().from(externalMcpClients).where(and(eq(externalMcpClients.userId, userId), eq(externalMcpClients.connected, true)));
  return rows.map((row) => {
    const session = oauthProvider(row);
    return {
      name: `oauth_${row.id.replaceAll("-", "")}`, url: row.url, headers: {}, self: false, toolMode: null,
      authProvider: session.provider, fetch: session.fetch,
    };
  });
}
