"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { apiKeys, oauthGrants, TOOL_MODES } from "@/db/schema";
import { runAction } from "@/lib/action-result";
import { displayPrefix, generateApiKey, hashApiKey } from "@/lib/api-keys";
import { requireActionUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
import { serviceScopesSchema } from "@/lib/service-scopes";

// Built per request so validation messages come back in the user's language.
const nameSchema = (t: Translator) => z.string().trim().min(1, t("Give the key a name")).max(60, t("Use 60 characters or fewer"));
const scopesSchema = serviceScopesSchema;
/** Null leaves it to the endpoint. */
const toolModeSchema = z.enum(TOOL_MODES).nullable();

const createSchema = (t: Translator) =>
  z.object({
    name: nameSchema(t),
    scopes: scopesSchema(t),
    toolMode: toolModeSchema.default(null),
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

export async function createApiKey(input: z.input<ReturnType<typeof createSchema>>) {
  return runAction(async () => {
    const user = await requireActionUser();
    const data = createSchema(await getT()).parse(input);
    const plaintext = generateApiKey();
    const [row] = await db
      .insert(apiKeys)
      .values({
        userId: user.id,
        name: data.name,
        prefix: displayPrefix(plaintext),
        hash: hashApiKey(plaintext),
        scopes: data.scopes,
        toolMode: data.toolMode,
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
    const data = z.object({ id: z.string().min(1), name: nameSchema(await getT()) }).parse(input);
    await ownedKey(user.id, data.id);
    await db.update(apiKeys).set({ name: data.name }).where(and(eq(apiKeys.id, data.id), eq(apiKeys.userId, user.id)));
    revalidatePath("/keys");
    return undefined;
  });
}

export async function updateApiKeyScopes(input: { id: string; scopes: string[] }) {
  return runAction(async () => {
    const user = await requireActionUser();
    const data = z.object({ id: z.string().min(1), scopes: scopesSchema(await getT()) }).parse(input);
    await ownedKey(user.id, data.id);
    await db.update(apiKeys).set({ scopes: data.scopes }).where(and(eq(apiKeys.id, data.id), eq(apiKeys.userId, user.id)));
    revalidatePath("/keys");
    return undefined;
  });
}

/** Sets how the key's clients see tools: every tool by name, the three search tools, or the endpoint's default (null). */
export async function updateApiKeyToolMode(input: { id: string; toolMode: string | null }) {
  return runAction(async () => {
    const user = await requireActionUser();
    const data = z.object({ id: z.string().min(1), toolMode: toolModeSchema }).parse(input);
    await ownedKey(user.id, data.id);
    await db.update(apiKeys).set({ toolMode: data.toolMode }).where(and(eq(apiKeys.id, data.id), eq(apiKeys.userId, user.id)));
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

/** Limits a connected app to some services. Apps connected to a single-service endpoint keep that one. */
export async function updateAppServices(input: { id: string; services: string[] }) {
  return runAction(async () => {
    const user = await requireActionUser();
    const data = z.object({ id: z.string().min(1), services: scopesSchema(await getT()) }).parse(input);
    const updated = await db
      .update(oauthGrants)
      .set({ scopes: data.services })
      .where(and(eq(oauthGrants.id, data.id), eq(oauthGrants.userId, user.id), isNull(oauthGrants.revokedAt), isNull(oauthGrants.service)))
      .returning({ id: oauthGrants.id });
    if (!updated.length) throw new Error("NOT_FOUND");
    revalidatePath("/keys/apps");
    return undefined;
  });
}

/** Sets how a connected app sees tools: every tool by name, the three search tools, or the endpoint's default (null). */
export async function updateAppToolMode(input: { id: string; toolMode: string | null }) {
  return runAction(async () => {
    const user = await requireActionUser();
    const data = z.object({ id: z.string().min(1), toolMode: toolModeSchema }).parse(input);
    const updated = await db
      .update(oauthGrants)
      .set({ toolMode: data.toolMode })
      .where(and(eq(oauthGrants.id, data.id), eq(oauthGrants.userId, user.id), isNull(oauthGrants.revokedAt)))
      .returning({ id: oauthGrants.id });
    if (!updated.length) throw new Error("NOT_FOUND");
    revalidatePath("/keys/apps");
    return undefined;
  });
}
