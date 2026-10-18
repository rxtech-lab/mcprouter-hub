"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { apiKeys, oauthGrants } from "@/db/schema";
import { serviceById } from "@/generated/registry";
import { runAction } from "@/lib/action-result";
import { displayPrefix, generateApiKey, hashApiKey } from "@/lib/api-keys";
import { requireActionUser } from "@/lib/auth";

const name = z.string().trim().min(1, "Give the key a name").max(60, "Use 60 characters or fewer");
const scopes = z
  .array(z.string())
  .max(50)
  .refine((ids) => ids.every((id) => serviceById.has(id)), "Unknown service")
  .transform((ids) => [...new Set(ids.map((id) => serviceById.get(id)!.id))].sort());

const createSchema = z.object({
  name,
  scopes,
  expiresInDays: z.union([z.literal(0), z.literal(30), z.literal(90), z.literal(365)]),
});

async function ownedKey(userId: string, id: string) {
  const [key] = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .limit(1);
  if (!key) throw new Error("NOT_FOUND");
  return key;
}

export async function createApiKey(input: z.input<typeof createSchema>) {
  return runAction(async () => {
    const user = await requireActionUser();
    const data = createSchema.parse(input);
    const plaintext = generateApiKey();
    const [row] = await db
      .insert(apiKeys)
      .values({
        userId: user.id,
        name: data.name,
        prefix: displayPrefix(plaintext),
        hash: hashApiKey(plaintext),
        scopes: data.scopes,
        expiresAt: data.expiresInDays ? new Date(Date.now() + data.expiresInDays * 86_400_000) : null,
      })
      .returning({ id: apiKeys.id, name: apiKeys.name });
    revalidatePath("/keys");
    // The only time the full key leaves the server.
    return { id: row.id, name: row.name, key: plaintext };
  });
}

export async function renameApiKey(input: { id: string; name: string }) {
  return runAction(async () => {
    const user = await requireActionUser();
    const data = z.object({ id: z.string().min(1), name }).parse(input);
    await ownedKey(user.id, data.id);
    await db.update(apiKeys).set({ name: data.name }).where(and(eq(apiKeys.id, data.id), eq(apiKeys.userId, user.id)));
    revalidatePath("/keys");
    return undefined;
  });
}

export async function updateApiKeyScopes(input: { id: string; scopes: string[] }) {
  return runAction(async () => {
    const user = await requireActionUser();
    const data = z.object({ id: z.string().min(1), scopes }).parse(input);
    await ownedKey(user.id, data.id);
    await db.update(apiKeys).set({ scopes: data.scopes }).where(and(eq(apiKeys.id, data.id), eq(apiKeys.userId, user.id)));
    revalidatePath("/keys");
    return undefined;
  });
}

export async function revokeApiKey(input: { id: string }) {
  return runAction(async () => {
    const user = await requireActionUser();
    const data = z.object({ id: z.string().min(1) }).parse(input);
    await ownedKey(user.id, data.id);
    await db.update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.id, data.id), eq(apiKeys.userId, user.id)));
    revalidatePath("/keys");
    revalidatePath("/dashboard");
    return undefined;
  });
}

export async function disconnectApp(input: { id: string }) {
  return runAction(async () => {
    const user = await requireActionUser();
    const data = z.object({ id: z.string().min(1) }).parse(input);
    const revoked = await db
      .update(oauthGrants)
      .set({ revokedAt: new Date() })
      .where(and(eq(oauthGrants.id, data.id), eq(oauthGrants.userId, user.id), isNull(oauthGrants.revokedAt)))
      .returning({ id: oauthGrants.id });
    if (!revoked.length) throw new Error("NOT_FOUND");
    revalidatePath("/keys/apps");
    return undefined;
  });
}
