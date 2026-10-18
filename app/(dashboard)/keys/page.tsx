import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { serviceById, services } from "@/generated/registry";
import { checkKeyUsable } from "@/lib/api-keys";
import { requirePageUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { siteUrl } from "@/lib/site";
import { KeysView, type KeyRow } from "./keys-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("API keys") };
}

export default async function KeysPage() {
  const user = await requirePageUser();
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.userId, user.id)).orderBy(desc(apiKeys.createdAt));
  const keys: KeyRow[] = rows
    .map((row): KeyRow => ({
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      // Scopes saved before services were merged are shown (and edited) as the service they became.
      scopes: [...new Set(row.scopes.map((id) => serviceById.get(id)?.id ?? id))],
      callCount: row.callCount,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      status: checkKeyUsable(row) ?? "active",
    }))
    .sort((a, b) => Number(a.status !== "active") - Number(b.status !== "active"));

  return (
    <KeysView
      keys={keys}
      services={services.map((service) => ({ id: service.id, title: service.title }))}
      endpoint={`${await siteUrl()}/api/mcp/streamable`}
    />
  );
}
