import crypto from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, type ApiKey } from "@/db/schema";

export const API_KEY_PREFIX = "mcpr_";
const PREFIX_DISPLAY_LENGTH = 12;
/** `lastUsedAt` is written at most this often per key, so hot keys don't write on every call. */
const LAST_USED_THROTTLE_MS = 5 * 60 * 1000;

export function generateApiKey() {
  return `${API_KEY_PREFIX}${crypto.randomBytes(24).toString("base64url")}`;
}

export function hashApiKey(plaintext: string) {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

export function displayPrefix(plaintext: string) {
  return plaintext.slice(0, PREFIX_DISPLAY_LENGTH);
}

export type KeyRejection = "unknown" | "revoked" | "expired";

export function checkKeyUsable(key: Pick<ApiKey, "revokedAt" | "expiresAt">, now = new Date()): KeyRejection | null {
  if (key.revokedAt) return "revoked";
  if (key.expiresAt && key.expiresAt.getTime() <= now.getTime()) return "expired";
  return null;
}

/** Whether a key scoped to `scopes` may call `serviceId`. An empty scope list allows everything; `[NO_SERVICES]` allows nothing. */
export function keyAllowsService(scopes: readonly string[], serviceId: string) {
  return scopes.length === 0 || scopes.includes(serviceId);
}

export function shouldTouchLastUsed(lastUsedAt: Date | null, now = new Date()) {
  return !lastUsedAt || now.getTime() - lastUsedAt.getTime() >= LAST_USED_THROTTLE_MS;
}

export async function findUsableApiKey(plaintext: string): Promise<ApiKey | null> {
  if (!plaintext.startsWith(API_KEY_PREFIX)) return null;
  const [key] = await db.select().from(apiKeys).where(eq(apiKeys.hash, hashApiKey(plaintext))).limit(1);
  if (!key || checkKeyUsable(key)) return null;
  if (shouldTouchLastUsed(key.lastUsedAt)) {
    void db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, key.id))
      .catch((error) => console.error("[api-keys] failed to update lastUsedAt", error));
  }
  return key;
}

export async function incrementCallCount(apiKeyId: string) {
  await db.update(apiKeys).set({ callCount: sql`${apiKeys.callCount} + 1` }).where(eq(apiKeys.id, apiKeyId));
}

/** Constant-time comparison for the internal agent key. */
export function matchesInternalKey(candidate: string) {
  const expected = process.env.MCPROUTER_INTERNAL_KEY?.trim();
  if (!expected || expected.length < 16) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Internal agent only: this message was already metered using the chat usage item. */
export const INTERNAL_CHAT_METERED_HEADER = "x-mcprouter-chat-metered";
export const INTERNAL_USER_HEADER = "x-mcprouter-user";
/** Which agent surface an internal call is for: `web`, `telegram` or `whatsapp`. */
export const INTERNAL_CHANNEL_HEADER = "x-mcprouter-channel";
/** Comma-separated service ids a bot link may call, sent with the internal key. Absent means every service. */
export const INTERNAL_SCOPES_HEADER = "x-mcprouter-scopes";
/** How a bot link lists tools (`all` or `search`), sent with the internal key. Absent means the endpoint's default. */
export const INTERNAL_TOOLS_HEADER = "x-mcprouter-tools";

/** Internal-key callers whose user id starts with this are signed-out visitors of the free agent. */
export const GUEST_USER_PREFIX = "guest:";
