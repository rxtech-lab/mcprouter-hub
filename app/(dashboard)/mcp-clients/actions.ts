"use server";

import { auth } from "@ai-sdk/mcp";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db, externalMcpClients } from "@/db";
import { runAction } from "@/lib/action-result";
import { requireActionUser } from "@/lib/auth";
import { connectionFor, oauthProvider } from "@/lib/external-mcp/provider";
import { assertPublicUrl, externalFetch } from "@/lib/external-mcp/safe-fetch";
import { seal, unseal } from "@/lib/sealed";
import { clientTools } from "@/lib/external-mcp/details";

export async function reloadClientTools(id: string) {
  return runAction(async () => {
    const user = await requireActionUser();
    const result = await clientTools(user.id, z.uuid().parse(id), true);
    if (result.error) throw new Error(result.error);
    revalidatePath("/mcp-clients");
  });
}

export async function connectClient(input: { name: string; url: string; clientId?: string; clientSecret?: string; id?: string }) {
  return runAction(async () => {
    const user = await requireActionUser();
    const data = z.object({ name: z.string().trim().min(1).max(80), url: z.url().max(2000), clientId: z.string().max(1000).optional(), clientSecret: z.string().max(2000).optional(), id: z.uuid().optional() }).parse(input);
    await assertPublicUrl(data.url);
    const requestHeaders = await headers();
    const origin = process.env.APP_URL ?? (process.env.NODE_ENV !== "production" ? `http://${requestHeaders.get("host") ?? "localhost:3000"}` : undefined);
    if (!origin) throw new Error("APP_URL must be configured");
    const id = data.id ?? crypto.randomUUID();
    if (data.id) {
      const previous = await connectionFor(user.id, id);
      const saved = JSON.parse(unseal("external-mcp", previous.credentials) ?? "{}");
      // A reconnect is a fresh interactive authorization, retaining only client registration.
      const credentials = seal("external-mcp", JSON.stringify({ client: saved.client, dynamic: saved.dynamic, server: saved.server }));
      await db.update(externalMcpClients).set({ connected: false, stateHash: null, credentials, toolsCache: null, toolsCacheVersion: sql`${externalMcpClients.toolsCacheVersion} + 1` }).where(and(eq(externalMcpClients.id, id), eq(externalMcpClients.userId, user.id)));
    } else {
      await db.insert(externalMcpClients).values({ id, userId: user.id, name: data.name, url: data.url, redirectUri: `${new URL(origin).origin}/api/external-mcp/callback`, credentials: seal("external-mcp", JSON.stringify(data.clientId ? { client: { client_id: data.clientId, ...(data.clientSecret ? { client_secret: data.clientSecret } : {}) } } : {})) });
    }
    const row = await connectionFor(user.id, id);
    const session = oauthProvider(row, true);
    await auth(session.provider, { serverUrl: row.url, fetchFn: externalFetch });
    revalidatePath("/mcp-clients");
    const url = session.authorizationUrl();
    if (!url) throw new Error("OAuth did not return an authorization URL");
    return { url };
  });
}

export async function disconnectClient(id: string) {
  return runAction(async () => {
    const user = await requireActionUser();
    await db.delete(externalMcpClients).where(and(eq(externalMcpClients.id, z.uuid().parse(id)), eq(externalMcpClients.userId, user.id)));
    revalidatePath("/mcp-clients");
  });
}
