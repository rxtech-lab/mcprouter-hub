import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { freeChatUsage } from "@/db/schema";
import { GUEST_USER_PREFIX } from "@/lib/api-keys";

/** Cookie that identifies a signed-out visitor of the free agent. */
export const GUEST_COOKIE = "mcpr_guest";

function parseLimit(raw: string | undefined, fallback: number) {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

/**
 * `FREE_CHAT_DAILY_LIMIT` messages per visitor per Hong Kong day (default 15, 0 turns the free chat off).
 * `FREE_CHAT_IP_DAILY_LIMIT` caps one network address, so clearing cookies doesn't reset the allowance
 * (default four times the visitor limit, to leave room for shared offices and schools).
 */
export function freeChatConfig(env: Record<string, string | undefined> = process.env) {
  const dailyLimit = parseLimit(env.FREE_CHAT_DAILY_LIMIT, 15);
  return {
    enabled: dailyLimit > 0,
    dailyLimit,
    ipDailyLimit: parseLimit(env.FREE_CHAT_IP_DAILY_LIMIT, dailyLimit * 4),
    model: env.FREE_CHAT_MODEL?.trim() || env.AI_MODEL?.trim() || "anthropic/claude-sonnet-5-5",
  };
}

const HK_OFFSET_MS = 8 * 3600 * 1000;

/** YYYY-MM-DD in Hong Kong time. */
export function hkDay(now = new Date()) {
  return new Date(now.getTime() + HK_OFFSET_MS).toISOString().slice(0, 10);
}

/** Midnight at the start of the next Hong Kong day, when the allowance resets. */
export function nextHkMidnight(now = new Date()) {
  const shifted = new Date(now.getTime() + HK_OFFSET_MS);
  shifted.setUTCHours(24, 0, 0, 0);
  return new Date(shifted.getTime() - HK_OFFSET_MS);
}

export function clientAddress(headers: Headers) {
  return headers.get("x-real-ip")?.trim() || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export type FreeChatSubjects = { guest: string | null; ip: string };

/** The rows a visitor is counted against. The address is hashed so raw IPs aren't stored. */
export function subjectsFor(guestId: string | null | undefined, address: string): FreeChatSubjects {
  return {
    guest: guestId ? `${GUEST_USER_PREFIX}${guestId}` : null,
    ip: `ip:${createHash("sha256").update(address).digest("hex").slice(0, 32)}`,
  };
}

export type FreeChatQuota = { limit: number; used: number; remaining: number; resetsAt: string };

function quota(guestUsed: number, ipUsed: number, config: ReturnType<typeof freeChatConfig>, now: Date): FreeChatQuota {
  // Whichever cap is closer decides what's left.
  const remaining = Math.max(0, Math.min(config.dailyLimit - guestUsed, config.ipDailyLimit - ipUsed));
  return { limit: config.dailyLimit, used: config.dailyLimit - remaining, remaining, resetsAt: nextHkMidnight(now).toISOString() };
}

export async function readFreeChatQuota(subjects: FreeChatSubjects, config = freeChatConfig(), now = new Date()) {
  const keys = [subjects.ip, ...(subjects.guest ? [subjects.guest] : [])];
  const rows = await db
    .select({ subject: freeChatUsage.subject, count: freeChatUsage.count })
    .from(freeChatUsage)
    .where(and(eq(freeChatUsage.day, hkDay(now)), inArray(freeChatUsage.subject, keys)));
  const used = (subject: string | null) => rows.find((row) => row.subject === subject)?.count ?? 0;
  return quota(used(subjects.guest), used(subjects.ip), config, now);
}

async function increment(subject: string, day: string) {
  const [row] = await db
    .insert(freeChatUsage)
    .values({ subject, day, count: 1 })
    .onConflictDoUpdate({ target: [freeChatUsage.subject, freeChatUsage.day], set: { count: sql`${freeChatUsage.count} + 1` } })
    .returning({ count: freeChatUsage.count });
  return row.count;
}

/**
 * Counts one message against the visitor and their address. The increment is atomic, so parallel
 * requests can't slip past the limit; a refused message has still been counted, which keeps it refused.
 */
export async function consumeFreeMessage(subjects: { guest: string; ip: string }, config = freeChatConfig(), now = new Date()) {
  const day = hkDay(now);
  const [guestUsed, ipUsed] = await Promise.all([increment(subjects.guest, day), increment(subjects.ip, day)]);
  const allowed = guestUsed <= config.dailyLimit && ipUsed <= config.ipDailyLimit;
  return { allowed, quota: quota(guestUsed, ipUsed, config, now) };
}

/** The allowance of whoever is making the current request, for pages and server actions. */
export async function currentFreeChatQuota() {
  const [jar, list] = await Promise.all([cookies(), headers()]);
  return readFreeChatQuota(subjectsFor(jar.get(GUEST_COOKIE)?.value, clientAddress(list)));
}
