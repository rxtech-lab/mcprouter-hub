import { auth } from "@ai-sdk/mcp";
import { and, eq, gt } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db, externalMcpClients } from "@/db";
import { oauthProvider, stateHash } from "@/lib/external-mcp/provider";
import { externalFetch } from "@/lib/external-mcp/safe-fetch";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in again before connecting" }, { status: 401 });
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const finish = (status: string) => Response.redirect(new URL(`/mcp-clients?status=${status}`, process.env.APP_URL ?? url.origin));
  if (!state || state.length > 1000) return finish("failed");
  // Consume state before exchange: callbacks are account-bound, short-lived and single-use.
  const [row] = await db.update(externalMcpClients).set({ stateHash: null, stateExpiresAt: null }).where(and(eq(externalMcpClients.userId, user.id), eq(externalMcpClients.stateHash, stateHash(state)), gt(externalMcpClients.stateExpiresAt, new Date()))).returning();
  if (!row || !code || code.length > 4000 || url.searchParams.has("error")) return finish("failed");
  try {
    const { provider } = oauthProvider(row);
    const result = await auth(provider, { serverUrl: row.url, authorizationCode: code, callbackState: state, callbackIssuer: url.searchParams.get("iss") ?? undefined, fetchFn: externalFetch });
    if (result !== "AUTHORIZED") return finish("failed");
    await db.update(externalMcpClients).set({ connected: true }).where(and(eq(externalMcpClients.id, row.id), eq(externalMcpClients.userId, user.id)));
    return finish("connected");
  } catch {
    return finish("failed");
  }
}
