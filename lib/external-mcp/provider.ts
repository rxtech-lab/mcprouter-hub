import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { MCPClientOAuthError } from "@ai-sdk/mcp";
import type { OAuthAuthorizationServerInformation, OAuthClientInformation, OAuthClientProvider, OAuthTokens } from "@ai-sdk/mcp";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import { db, externalMcpClients } from "@/db";
import { seal, unseal } from "@/lib/sealed";
import { assertPublicUrl, externalFetch } from "./safe-fetch";

type Credentials = {
  client?: OAuthClientInformation;
  dynamic?: boolean;
  tokens?: OAuthTokens;
  verifier?: string;
  state?: string;
  server?: OAuthAuthorizationServerInformation;
};
export const stateHash = (state: string) => createHash("sha256").update(state).digest("hex");

export async function connectionFor(userId: string, id: string) {
  const [row] = await db.select().from(externalMcpClients).where(and(eq(externalMcpClients.userId, userId), eq(externalMcpClients.id, id)));
  if (!row) throw new Error("NOT_FOUND");
  return row;
}

export function oauthProvider(row: typeof externalMcpClients.$inferSelect, interactive = false) {
  const decrypted = unseal("external-mcp", row.credentials);
  if (!decrypted) throw new Error("Cannot read MCP credentials");
  const credentials: Credentials = JSON.parse(decrypted);
  let revision = row.credentials;
  let redirectUrl: string | undefined;
  let refreshLease: string | undefined;
  async function releaseRefresh() {
    if (!refreshLease) return;
    await db.update(externalMcpClients).set({ refreshLeaseId: null, refreshLeaseUntil: null }).where(and(eq(externalMcpClients.id, row.id), eq(externalMcpClients.refreshLeaseId, refreshLease)));
    refreshLease = undefined;
  }
  const fetchWithRefreshLock: typeof fetch = async (input, init) => {
    const outgoing = new Request(input, init);
    const body = outgoing.method === "POST" ? await outgoing.clone().text() : "";
    if (new URLSearchParams(body).get("grant_type") === "refresh_token") {
      const leaseId = crypto.randomUUID();
      const acquired = await db.update(externalMcpClients).set({ refreshLeaseId: leaseId, refreshLeaseUntil: new Date(Date.now() + 60_000) }).where(and(where(), or(isNull(externalMcpClients.refreshLeaseUntil), lte(externalMcpClients.refreshLeaseUntil, new Date())))).returning({ id: externalMcpClients.id });
      if (!acquired.length) throw new MCPClientOAuthError({ message: "Connection is refreshing or changed. Retry the request." });
      refreshLease = leaseId;
    }
    try {
      const response = await externalFetch(outgoing);
      if (!response.ok) await releaseRefresh();
      return response;
    } catch (error) { await releaseRefresh(); throw error; }
  };
  const where = () => and(eq(externalMcpClients.id, row.id), eq(externalMcpClients.userId, row.userId), eq(externalMcpClients.credentials, revision));
  async function persist() {
    const next = seal("external-mcp", JSON.stringify(credentials));
    const result = await db.update(externalMcpClients).set({ credentials: next }).where(where()).returning({ id: externalMcpClients.id });
    if (!result.length) throw new Error("Connection changed. Retry the request.");
    revision = next;
  }
  const provider: OAuthClientProvider = {
    redirectUrl: row.redirectUri,
    clientMetadata: { redirect_uris: [row.redirectUri], client_name: "mcprouter", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: credentials.client?.client_secret ? "client_secret_post" : "none" },
    clientInformation: () => credentials.client,
    isClientInformationDynamicallyRegistered: () => credentials.dynamic ?? false,
    saveClientInformation: async (client) => { credentials.client = client; credentials.dynamic = true; await persist(); },
    tokens: () => credentials.tokens,
    saveTokens: async (tokens) => { credentials.tokens = { ...tokens, refresh_token: tokens.refresh_token ?? credentials.tokens?.refresh_token }; await persist(); await releaseRefresh(); },
    saveCodeVerifier: async (verifier) => { credentials.verifier = verifier; await persist(); },
    codeVerifier: () => { if (!credentials.verifier) throw new Error("OAuth session expired"); return credentials.verifier; },
    state: () => {
      if (!interactive) throw new MCPClientOAuthError({ message: "Reconnect this MCP client from /mcp-clients" });
      return randomBytes(32).toString("base64url");
    },
    saveState: async (state) => {
      credentials.state = state;
      await persist();
      await db.update(externalMcpClients).set({ stateHash: stateHash(state), stateExpiresAt: new Date(Date.now() + 600_000) }).where(where());
    },
    storedState: () => credentials.state,
    authorizationServerInformation: () => credentials.server,
    saveAuthorizationServerInformation: async (server) => { credentials.server = server; await persist(); },
    validateAuthorizationServerURL: async (_server, url) => { await assertPublicUrl(url); },
    redirectToAuthorization: async (url) => {
      await assertPublicUrl(url);
      if (!interactive) throw new Error("Reconnect this MCP client from /mcp-clients");
      redirectUrl = url.toString();
    },
    invalidateCredentials: async (scope, context) => {
      if (context && credentials.tokens?.access_token !== context.tokens.access_token) return;
      if (scope === "all" || scope === "tokens") delete credentials.tokens;
      if (scope === "all" || scope === "client") delete credentials.client;
      if (scope === "all" || scope === "verifier") delete credentials.verifier;
      await persist();
    },
  };
  return { provider, fetch: fetchWithRefreshLock, authorizationUrl: () => redirectUrl };
}
