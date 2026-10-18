import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { whatsappLinks } from "@/db/schema";
import type { AppUser } from "@/lib/auth";

/** How long a sign-in link sent on WhatsApp stays valid. */
export const LINK_TOKEN_TTL_MS = 30 * 60 * 1000;

/** The number is only ever stored hashed. */
export function phoneHash(from: string) {
  return createHash("sha256").update(`whatsapp:${from}`).digest("hex").slice(0, 32);
}

function secret() {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value) throw new Error("AUTH_SECRET must be set to link WhatsApp numbers");
  return value;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(`whatsapp-link:${payload}`).digest("base64url");

/**
 * A link token names the number (as its hash and last digits) and expires after 30 minutes.
 * It's signed, so nobody can mint one for a number they don't hold.
 */
export function createLinkToken(from: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ h: phoneHash(from), d: from.slice(-4), e: now + LINK_TOKEN_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export type LinkTokenClaims = { phoneHash: string; phoneHint: string; expiresAt: number };

/** The token's claims, or null when it's malformed, tampered with or expired. */
export function readLinkToken(token: string | null | undefined, now = Date.now()): LinkTokenClaims | null {
  const [payload, signature, extra] = token?.split(".") ?? [];
  if (!payload || !signature || extra !== undefined) return null;
  const given = Buffer.from(signature);
  const expected = Buffer.from(sign(payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as { h?: unknown; d?: unknown; e?: unknown };
    if (typeof claims.h !== "string" || typeof claims.d !== "string" || typeof claims.e !== "number" || claims.e < now) return null;
    return { phoneHash: claims.h, phoneHint: claims.d, expiresAt: claims.e };
  } catch {
    return null;
  }
}

export function maskedNumber(hint: string) {
  return `••••${hint}`;
}

export async function findLink(hash: string) {
  const [link] = await db.select().from(whatsappLinks).where(eq(whatsappLinks.phoneHash, hash)).limit(1);
  return link ?? null;
}

/** Links the number to the user. A number belongs to one account; linking it again moves it. */
export async function linkNumber(user: Pick<AppUser, "id" | "email">, claims: LinkTokenClaims) {
  const values = { userId: user.id, userEmail: user.email, phoneHint: claims.phoneHint };
  await db
    .insert(whatsappLinks)
    .values({ phoneHash: claims.phoneHash, ...values })
    .onConflictDoUpdate({ target: whatsappLinks.phoneHash, set: { ...values, createdAt: new Date() } });
}

export async function listLinks(userId: string) {
  return db.select().from(whatsappLinks).where(eq(whatsappLinks.userId, userId)).orderBy(desc(whatsappLinks.createdAt));
}

export async function unlinkNumber(userId: string, hash: string) {
  const removed = await db
    .delete(whatsappLinks)
    .where(and(eq(whatsappLinks.phoneHash, hash), eq(whatsappLinks.userId, userId)))
    .returning({ phoneHash: whatsappLinks.phoneHash });
  if (removed.length === 0) throw new Error("NOT_FOUND");
}
