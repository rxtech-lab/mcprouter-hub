import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { serviceById, services } from "@/generated/registry";
import { checkKeyUsable } from "@/lib/api-keys";
import { requirePageUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { siteUrl } from "@/lib/site";
import { KeysView, type KeyRow, type OpenDialog } from "./keys-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("API keys") };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

/**
 * A dialog to open with the page, from the URL (the agent links here to start an action):
 * `?create=1&name=…` creates a key, `?rename=<id>`, `?scopes=<id>`, `?toolMode=<id>` or `?revoke=<id>` act on one.
 */
function openDialog(raw: Record<string, string | string[] | undefined>, keys: KeyRow[]): OpenDialog | undefined {
  if (first(raw.create)) return { kind: "create", name: first(raw.name)?.slice(0, 60) };
  for (const kind of ["rename", "scopes", "toolMode", "revoke"] as const) {
    const id = first(raw[kind]);
    const key = id ? keys.find((row) => row.id === id && row.status === "active") : undefined;
    if (key) return { kind, key };
  }
  return undefined;
}

export default async function KeysPage({ searchParams }: PageProps<"/keys">) {
  const user = await requirePageUser();
  const raw = await searchParams;
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.userId, user.id)).orderBy(desc(apiKeys.createdAt));
  const keys: KeyRow[] = rows
    .map((row): KeyRow => ({
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      // Scopes saved before services were merged are shown (and edited) as the service they became.
      scopes: [...new Set(row.scopes.map((id) => serviceById.get(id)?.id ?? id))],
      toolMode: row.toolMode,
      callCount: row.callCount,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      status: checkKeyUsable(row) ?? "active",
    }))
    .sort((a, b) => Number(a.status !== "active") - Number(b.status !== "active"));

  const initial = openDialog(raw, keys);
  return (
    <KeysView
      // A new dialog in the URL starts the view afresh, with that dialog open.
      key={initial ? JSON.stringify(raw) : "keys"}
      initial={initial}
      keys={keys}
      services={services.map((service) => ({ id: service.id, title: service.title, region: service.region, tools: service.tools.length }))}
      endpoint={`${await siteUrl()}/api/mcp/streamable`}
    />
  );
}
