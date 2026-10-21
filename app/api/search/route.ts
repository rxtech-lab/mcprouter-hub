import { cookies } from "next/headers";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { clientAddress, consumeFreeMessage, freeChatConfig, GUEST_COOKIE, subjectsFor } from "@/lib/free-chat";
import { isLocale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { getT } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import { searchSite } from "@/lib/site-search/catalogue";
import { decideSearchIntent } from "@/lib/site-search/decision";

export const maxDuration = 15;
const schema = z.object({ query: z.string().trim().min(1).max(2000), locale: z.string().optional() });
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const translator = async (locale: unknown) => isLocale(locale) ? createTranslator(locale, getMessages(locale)) : getT();

/** Live keyword suggestions are deterministic and never call a model or consume chat allowance. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q") ?? "";
  if (query.length > 2000) return json({ error: "Keep searches under 2000 characters." }, 400);
  return json({ intent: "search", results: searchSite(query, await translator(params.get("locale"))) });
}

/** Each debounced query classifies once. The existing /api/free-chat handles answers and metering. */
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 12_000) return json({ error: "Search request is too large." }, 413);
  let parsed;
  try { parsed = schema.safeParse(JSON.parse(raw)); } catch { return json({ error: "Bad request." }, 400); }
  if (!parsed.success) return json({ error: "Enter a search under 2000 characters." }, 400);
  const { query, locale } = parsed.data;
  const results = searchSite(query, await translator(locale));
  const fallback = () => json({ intent: "search", results, fallback: true });
  try {
    const user = await getCurrentUser();
    if (!user && !freeChatConfig().enabled) return fallback();
    const jar = await cookies();
    const guestId = jar.get(GUEST_COOKIE)?.value ?? crypto.randomUUID();
    if (!user) jar.set(GUEST_COOKIE, guestId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
    // Separate namespace: model routing cannot exhaust the visitor's chat messages.
    // The shared IP cap prevents cookie resets or many sessions from bypassing it.
    const subjects = subjectsFor(`search-router:${user?.id ?? guestId}`, `search-router:${clientAddress(request.headers)}`);
    const { allowed } = await consumeFreeMessage({ guest: subjects.guest!, ip: subjects.ip }, { ...freeChatConfig(), dailyLimit: 60, ipDailyLimit: 240 });
    if (!allowed) return fallback();
    return json({ intent: await decideSearchIntent(query, { signal: request.signal }), results });
  } catch {
    console.warn("[search] Decision unavailable; using text search.");
    return fallback();
  }
}
