import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { oauthClients, oauthGrants } from "@/db/schema";
import { serviceById } from "@/generated/registry";
import { requirePageUser } from "@/lib/auth";
import { siteUrl } from "@/lib/site";
import { AppsView, type AppRow } from "./apps-view";

export const metadata = { title: "Connected apps" };

export default async function ConnectedAppsPage() {
  const user = await requirePageUser();
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
  return <AppsView apps={apps} endpoint={`${await siteUrl()}/api/mcp/streamable`} />;
}
