import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { telegramLinks } from "@/db/schema";
import type { AppUser } from "@/lib/auth";

/** How long a sign-in link sent on Telegram stays valid. */
export const LINK_TOKEN_TTL_MS = 30 * 60 * 1000;

/** The Telegram user id is only ever stored hashed. */
export function telegramHash(from: string) {
  return createHash("sha256").update(`telegram:${from}`).digest("hex").slice(0, 32);
}

function secret() {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value) throw new Error("AUTH_SECRET must be set to link Telegram accounts");
  return value;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(`telegram-link:${payload}`).digest("base64url");

/**
 * A link token names the Telegram account (as its hash and display name) and expires after 30 minutes.
 * It's signed, so nobody can mint one for an account they don't hold.
 */
export function createLinkToken(from: string, name: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ h: telegramHash(from), n: name.slice(0, 64), e: now + LINK_TOKEN_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export type LinkTokenClaims = { telegramHash: string; displayName: string; expiresAt: number };

/** The token's claims, or null when it's malformed, tampered with or expired. */
export function readLinkToken(token: string | null | undefined, now = Date.now()): LinkTokenClaims | null {
  const [payload, signature, extra] = token?.split(".") ?? [];
  if (!payload || !signature || extra !== undefined) return null;
  const given = Buffer.from(signature);
  const expected = Buffer.from(sign(payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as { h?: unknown; n?: unknown; e?: unknown };
    if (typeof claims.h !== "string" || typeof claims.n !== "string" || typeof claims.e !== "number" || claims.e < now) return null;
    return { telegramHash: claims.h, displayName: claims.n, expiresAt: claims.e };
  } catch {
    return null;
  }
}

export async function findLink(hash: string) {
  const [link] = await db.select().from(telegramLinks).where(eq(telegramLinks.telegramHash, hash)).limit(1);
  return link ?? null;
}

/** Links the Telegram account to the user. It belongs to one account; linking it again moves it. */
export async function linkAccount(user: Pick<AppUser, "id" | "email">, claims: LinkTokenClaims) {
  const values = { userId: user.id, userEmail: user.email, displayName: claims.displayName };
  await db
    .insert(telegramLinks)
    .values({ telegramHash: claims.telegramHash, ...values })
    .onConflictDoUpdate({ target: telegramLinks.telegramHash, set: { ...values, createdAt: new Date() } });
}

export async function listLinks(userId: string) {
  return db.select().from(telegramLinks).where(eq(telegramLinks.userId, userId)).orderBy(desc(telegramLinks.createdAt));
}

export async function unlinkAccount(userId: string, hash: string) {
  const removed = await db
    .delete(telegramLinks)
    .where(and(eq(telegramLinks.telegramHash, hash), eq(telegramLinks.userId, userId)))
    .returning({ telegramHash: telegramLinks.telegramHash });
  if (removed.length === 0) throw new Error("NOT_FOUND");
}
