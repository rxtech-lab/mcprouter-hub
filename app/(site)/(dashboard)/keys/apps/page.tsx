import { and, desc, eq, gt, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { z } from "zod";
import { db } from "@/db";
import { oauthClients, oauthGrants } from "@/db/schema";
import { serviceById } from "@/generated/registry";
import { requirePageUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { serviceSelection } from "@/lib/service-scopes";
import { TOOL_MODES } from "@/lib/mcp/meta-tools";
import { KEY_PLACEHOLDER, MCP_CLIENTS, mcpClientById } from "@/lib/mcp-clients";
import { siteUrl } from "@/lib/site";
import { AppsView, type AppRow, type ClientGuide } from "./apps-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Connected apps") };
}

/**
 * `?client=<id>` opens the setup dialog for that client; `&auth=key` switches it to the API-key flow,
 * and `&tools=all` to an endpoint that lists every tool instead of only the three search tools.
 * `?services=<grant id>` opens the dialog that limits a connected app to some services,
 * and `?toolMode=<grant id>` the one that sets how it sees tools.
 */
const paramsSchema = z.object({
  client: z.string().optional().catch(undefined),
  auth: z.enum(["oauth", "key"]).catch("oauth"),
  tools: z.enum(TOOL_MODES).catch("search"),
  services: z.string().optional().catch(undefined),
  toolMode: z.string().optional().catch(undefined),
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
    scopes: serviceSelection(grant.scopes),
    toolMode: grant.toolMode,
    lastUsedAt: grant.lastUsedAt?.toISOString() ?? null,
    createdAt: grant.createdAt.toISOString(),
  }));

  const endpoint = `${await siteUrl()}/api/mcp/streamable${params.tools === "all" ? "?tools=all" : ""}`;
  const client = mcpClientById(params.client);
  const auth = client?.apiKey ? params.auth : "oauth";
  const guide: ClientGuide | null = client
    ? {
        id: client.id,
        name: client.name,
        kind: client.kind,
        auth,
        tools: params.tools,
        supportsApiKey: Boolean(client.apiKey),
        steps: auth === "key" && client.apiKey ? client.apiKey(endpoint, KEY_PLACEHOLDER) : client.oauth(endpoint),
        note: client.note ?? null,
      }
    : null;

  // Apps connected to a single-service endpoint are limited to it already.
  const editing = apps.find((app) => app.id === params.services && !app.service) ?? null;
  const editingTools = apps.find((app) => app.id === params.toolMode) ?? null;
  return (
    <AppsView
      apps={apps}
      clients={MCP_CLIENTS.map(({ id, name, kind }) => ({ id, name, kind }))}
      guide={guide}
      editing={editing}
      editingTools={editingTools}
    />
  );
}
