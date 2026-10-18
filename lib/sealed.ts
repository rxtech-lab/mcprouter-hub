import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Small values encrypted with a key derived from `AUTH_SECRET` (AES-256-GCM), for
 * things a link token must carry but a URL mustn't show, like the chat to reply to.
 */

function key(purpose: string) {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) throw new Error("AUTH_SECRET must be set");
  return createHash("sha256").update(`sealed:${purpose}:${secret}`).digest();
}

export function seal(purpose: string, value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(purpose), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

/** The sealed value, or null when it's malformed or was sealed for another purpose or secret. */
export function unseal(purpose: string, sealed: unknown) {
  if (typeof sealed !== "string") return null;
  try {
    const bytes = Buffer.from(sealed, "base64url");
    if (bytes.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(purpose), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
