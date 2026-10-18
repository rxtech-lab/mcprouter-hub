import { and, desc, eq, gt, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { z } from "zod";
import { db } from "@/db";
import { oauthClients, oauthGrants } from "@/db/schema";
import { serviceById } from "@/generated/registry";
import { requirePageUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { KEY_PLACEHOLDER, MCP_CLIENTS, mcpClientById } from "@/lib/mcp-clients";
import { siteUrl } from "@/lib/site";
import { AppsView, type AppRow, type ClientGuide } from "./apps-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Connected apps") };
}

/** `?client=<id>` opens the setup dialog for that client; `&auth=key` switches it to the API-key flow. */
const paramsSchema = z.object({
  client: z.string().optional().catch(undefined),
  auth: z.enum(["oauth", "key"]).catch("oauth"),
});

export default async function ConnectedAppsPage({ searchParams }: PageProps<"/keys/apps">) {
  const user = await requirePageUser();
  const raw = await searchParams;
  const params = paramsSchema.parse(Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])));
  const rows = await db
    .select({ grant: oauthGrants, clientName: oauthClients.name })
    .from(oauthGrants)
    .innerJoin(oauthClients, eq(oauthClients.id, oauthGrants.clientId))
    .where(and(eq(oauthGrants.userId, user.id), isNull(oauthGrants.revokedAt), gt(oauthGrants.expiresAt, new Date())))
    .orderBy(desc(oauthGrants.createdAt));
  const apps: AppRow[] = rows.map(({ grant, clientName }) => ({
    id: grant.id,
    name: clientName,
    service: grant.service ? (serviceById.get(grant.service)?.title ?? grant.service) : null,
    lastUsedAt: grant.lastUsedAt?.toISOString() ?? null,
    createdAt: grant.createdAt.toISOString(),
  }));

  const endpoint = `${await siteUrl()}/api/mcp/streamable`;
  const client = mcpClientById(params.client);
  const auth = client?.apiKey ? params.auth : "oauth";
  const guide: ClientGuide | null = client
    ? {
        id: client.id,
        name: client.name,
        kind: client.kind,
        auth,
        supportsApiKey: Boolean(client.apiKey),
        steps: auth === "key" && client.apiKey ? client.apiKey(endpoint, KEY_PLACEHOLDER) : client.oauth(endpoint),
        note: client.note ?? null,
      }
    : null;

  return <AppsView apps={apps} clients={MCP_CLIENTS.map(({ id, name, kind }) => ({ id, name, kind }))} guide={guide} />;
}
