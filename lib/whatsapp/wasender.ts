import { timingSafeEqual } from "node:crypto";

/**
 * WasenderAPI (wasenderapi.com) connects a WhatsApp number through a session.
 * It posts incoming messages to `/api/whatsapp` with the session's webhook
 * secret in `X-Webhook-Signature`, and replies go out through
 * `POST /api/send-message` with the session's API key.
 */

const API_BASE = "https://www.wasenderapi.com/api";

/** Long replies are split so each message stays readable on a phone. */
export const WHATSAPP_TEXT_LIMIT = 4096;

export function whatsAppConfig(env: Record<string, string | undefined> = process.env) {
  const apiKey = env.WASENDER_API_KEY?.trim();
  const webhookSecret = env.WASENDER_WEBHOOK_SECRET?.trim();
  return {
    enabled: Boolean(apiKey && webhookSecret),
    apiKey,
    webhookSecret,
    model: env.WHATSAPP_MODEL?.trim() || env.AI_MODEL?.trim() || "anthropic/claude-sonnet-5-5",
  };
}

export type WhatsAppConfig = ReturnType<typeof whatsAppConfig>;

/** Wasender sends the webhook secret itself as `X-Webhook-Signature`; compared in constant time. */
export function verifySignature(header: string | null, secret: string) {
  if (!header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type IncomingMessage = {
  /** Unique per message; used to drop repeats. */
  id: string;
  /** The sender's number, digits only, international format. */
  from: string;
  /** Text body, or null for media, locations, reactions and other types the bot doesn't read. */
  text: string | null;
};

type WasenderMessage = {
  key?: { id?: string; fromMe?: boolean; remoteJid?: string; senderPn?: string; cleanedSenderPn?: string };
  messageBody?: string;
  message?: { conversation?: string; extendedTextMessage?: { text?: string } };
};

type WebhookPayload = { event?: string; data?: { messages?: WasenderMessage | WasenderMessage[] } };

const digits = (value: string | undefined) => value?.split("@")[0]?.split(":")[0]?.replace(/\D/g, "") || null;

/** One-to-one messages people sent to the bot. Its own messages, groups, channels and status updates are ignored. */
export function parseIncomingMessages(payload: unknown): IncomingMessage[] {
  const body = payload as WebhookPayload;
  if (body?.event !== "messages.received" && body?.event !== "messages.upsert") return [];
  const raw = body.data?.messages;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const messages: IncomingMessage[] = [];
  for (const message of list) {
    const key = message.key;
    if (!key?.id || key.fromMe) continue;
    const jid = key.remoteJid ?? "";
    if (/@(g\.us|newsletter|broadcast)$/.test(jid) || jid === "status@broadcast") continue;
    // With LID addressing the chat id isn't a number; the sender's number comes separately.
    const from = digits(key.cleanedSenderPn) ?? digits(key.senderPn) ?? (jid.endsWith("@s.whatsapp.net") ? digits(jid) : null);
    if (!from) continue;
    const text = message.messageBody ?? message.message?.conversation ?? message.message?.extendedTextMessage?.text ?? null;
    messages.push({ id: key.id, from, text: text?.trim() ? text : null });
  }
  return messages;
}

/**
 * Markdown → WhatsApp formatting: `*bold*`, `_italic_`, `~strike~`, and ``` blocks
 * pass through. Headings become bold lines, bullets become `•`, links show their URL.
 */
export function toWhatsAppText(markdown: string) {
  const BOLD = "\u0000";
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+(.+?)\s*#*$/gm, `${BOLD}$1${BOLD}`)
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a: string | undefined, b: string | undefined) => `${BOLD}${a ?? b}${BOLD}`)
    .replace(/^(\s*)[-*+]\s+/gm, "$1• ")
    .replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?!\w)/g, "$1_$2_")
    .replace(/~~(.+?)~~/g, "~$1~")
    .replace(/!?\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label: string, url: string) => (label === url ? url : `${label} (${url})`))
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/gm, "")
    .replace(new RegExp(BOLD, "g"), "*")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits a reply into messages, preferring paragraph, then line, then word breaks. */
export function splitMessage(text: string, limit = WHATSAPP_TEXT_LIMIT) {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    const cut = [window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf(" ")].find((index) => index > limit / 2) ?? limit;
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export class WasenderApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`WasenderAPI ${status}: ${body.slice(0, 300)}`);
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function post(config: WhatsAppConfig, path: string, payload: object, fetcher: typeof fetch, retries = 1): Promise<void> {
  const response = await fetcher(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  // Wasender rate-limits per session; wait as long as it asks (capped) and try once more.
  if (response.status === 429 && retries > 0) {
    const seconds = Number(response.headers.get("retry-after"));
    await wait(Math.min(Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 5000, 15_000));
    return post(config, path, payload, fetcher, retries - 1);
  }
  if (!response.ok) throw new WasenderApiError(response.status, await response.text());
}

/** Sends the reply, split into as many messages as it takes. */
export async function sendText(config: WhatsAppConfig, to: string, text: string, fetcher: typeof fetch = fetch) {
  for (const body of splitMessage(text)) {
    await post(config, "/send-message", { to: `+${to}`, text: body }, fetcher);
  }
}

/** Shows "typing…" in the chat while the agent works. */
export async function sendTyping(config: WhatsAppConfig, to: string, fetcher: typeof fetch = fetch) {
  await post(config, "/send-presence-update", { jid: `${to}@s.whatsapp.net`, type: "composing" }, fetcher, 0);
}
