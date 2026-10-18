import { timingSafeEqual } from "node:crypto";

/**
 * Telegram Bot API (core.telegram.org/bots/api). Telegram posts updates to
 * `/api/telegram` with the webhook's secret token in
 * `X-Telegram-Bot-Api-Secret-Token`, and replies go out through
 * `https://api.telegram.org/bot<token>/<method>`.
 */

const API_BASE = "https://api.telegram.org";

/** Telegram's limit is 4096 characters after entity parsing; markdown is split below it so HTML escaping can't push a chunk over. */
export const TELEGRAM_TEXT_LIMIT = 3500;

export function telegramConfig(env: Record<string, string | undefined> = process.env) {
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim();
  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  return {
    enabled: Boolean(botToken && webhookSecret),
    botToken,
    webhookSecret,
    /** Without the leading @, for t.me links. */
    botUsername: env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") || null,
    model: env.TELEGRAM_MODEL?.trim() || env.AI_MODEL?.trim() || "anthropic/claude-sonnet-5-5",
  };
}

export type TelegramConfig = ReturnType<typeof telegramConfig>;

/** Telegram sends the secret token itself as the header; compared in constant time. */
export function verifySecretToken(header: string | null, secret: string) {
  if (!header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type IncomingMessage = {
  /** Unique per message (chat id and message id); used to drop repeats. */
  id: string;
  /** Where replies go. In a private chat it's the user's id. */
  chatId: number;
  /** The sender's Telegram user id. */
  from: string;
  /** `@username`, or the first name when there's none. Shown on linked accounts. */
  name: string;
  /** Text body, or null for photos, stickers, voice notes and other types the bot doesn't read. */
  text: string | null;
};

type TelegramMessage = {
  message_id?: number;
  from?: { id?: number; is_bot?: boolean; first_name?: string; username?: string };
  chat?: { id?: number; type?: string };
  text?: string;
};

type Update = { update_id?: number; message?: TelegramMessage };

/** Messages people sent the bot in a private chat. Groups, channels, edits and other bots are ignored. */
export function parseUpdate(payload: unknown): IncomingMessage | null {
  const message = (payload as Update | null)?.message;
  const chatId = message?.chat?.id;
  const from = message?.from;
  if (!message?.message_id || typeof chatId !== "number" || message.chat?.type !== "private") return null;
  if (typeof from?.id !== "number" || from.is_bot) return null;
  const name = from.username ? `@${from.username}` : from.first_name?.trim() || `user ${String(from.id).slice(-4)}`;
  const text = message.text?.trim() ? message.text : null;
  return { id: `tg_${chatId}_${message.message_id}`, chatId, from: String(from.id), name, text };
}

/** `/new`, `/new@mcprouter_bot` and `/start payload` → `/new`, `/start`; null for anything that isn't a command. */
export function commandOf(text: string) {
  const match = /^\/([a-z0-9_]+)(?:@\w+)?(?:\s|$)/i.exec(text.trim());
  return match ? `/${match[1].toLowerCase()}` : null;
}

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Markdown → Telegram HTML (`parse_mode: "HTML"`): bold, italic, strike, inline code,
 * code blocks and links. Headings become bold lines, bullets become `•`, table rules are dropped.
 */
export function toTelegramHtml(markdown: string) {
  const blocks: string[] = [];
  const stash = (html: string) => `\u0000${blocks.push(html) - 1}\u0000`;
  return escapeHtml(markdown.replace(/\r\n/g, "\n"))
    .replace(/```[\w-]*\n?([\s\S]*?)```/g, (_, code: string) => stash(`<pre>${code.replace(/\n$/, "")}</pre>`))
    .replace(/`([^`\n]+)`/g, (_, code: string) => stash(`<code>${code}</code>`))
    .replace(/!?\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label: string, url: string) => stash(`<a href="${url.replace(/"/g, "&quot;")}">${label}</a>`))
    .replace(/^#{1,6}\s+(.+?)\s*#*$/gm, "<b>$1</b>")
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a: string | undefined, b: string | undefined) => `<b>${a ?? b}</b>`)
    .replace(/^(\s*)[-*+]\s+/gm, "$1• ")
    .replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?!\w)/g, "$1<i>$2</i>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/gm, "")
    .replace(/\u0000(\d+)\u0000/g, (_, index: string) => blocks[Number(index)])
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits a reply into messages, preferring paragraph, then line, then word breaks. */
export function splitMessage(text: string, limit = TELEGRAM_TEXT_LIMIT) {
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

export class TelegramApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Telegram ${status}: ${body.slice(0, 300)}`);
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Calls a Bot API method with a JSON payload, or a multipart one (`FormData`) for uploads. */
export async function callTelegram(config: Pick<TelegramConfig, "botToken">, method: string, payload: object | FormData, fetcher: typeof fetch = fetch, retries = 1): Promise<unknown> {
  const multipart = payload instanceof FormData;
  const response = await fetcher(`${API_BASE}/bot${config.botToken}/${method}`, {
    method: "POST",
    headers: multipart ? undefined : { "Content-Type": "application/json" },
    body: multipart ? payload : JSON.stringify(payload),
    signal: AbortSignal.timeout(multipart ? 30_000 : 15_000),
  });
  // Flood control: wait as long as Telegram asks (capped) and try once more.
  if (response.status === 429 && retries > 0) {
    const body = (await response.json().catch(() => null)) as { parameters?: { retry_after?: number } } | null;
    const seconds = Number(body?.parameters?.retry_after);
    await wait(Math.min(Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 5000, 15_000));
    return callTelegram(config, method, payload, fetcher, retries - 1);
  }
  if (!response.ok) throw new TelegramApiError(response.status, await response.text());
  return ((await response.json()) as { result?: unknown }).result;
}

export type LinkButton = { text: string; url: string };

/**
 * Sends a markdown reply as HTML, split into as many messages as it takes. A chunk Telegram
 * can't parse goes out as plain text instead. The button goes under the last message.
 */
export async function sendText(config: TelegramConfig, chatId: number, markdown: string, button?: LinkButton, fetcher: typeof fetch = fetch) {
  const chunks = splitMessage(markdown);
  for (const [index, chunk] of chunks.entries()) {
    const markup = button && index === chunks.length - 1 ? { reply_markup: { inline_keyboard: [[button]] } } : {};
    const base = { chat_id: chatId, link_preview_options: { is_disabled: true }, ...markup };
    try {
      await callTelegram(config, "sendMessage", { ...base, text: toTelegramHtml(chunk), parse_mode: "HTML" }, fetcher);
    } catch (error) {
      if (!(error instanceof TelegramApiError) || error.status !== 400) throw error;
      await callTelegram(config, "sendMessage", { ...base, text: chunk }, fetcher);
    }
  }
}

/** Uploads a PNG and sends it as a photo. */
export async function sendPhoto(config: TelegramConfig, chatId: number, png: Uint8Array, fetcher: typeof fetch = fetch) {
  const form = new FormData();
  form.set("chat_id", String(chatId));
  form.set("photo", new Blob([new Uint8Array(png)], { type: "image/png" }), "card.png");
  await callTelegram(config, "sendPhoto", form, fetcher);
}

/** Shows "typing…" in the chat. Telegram clears it after 5 seconds or when a message arrives. */
export async function sendTyping(config: TelegramConfig, chatId: number, fetcher: typeof fetch = fetch) {
  await callTelegram(config, "sendChatAction", { chat_id: chatId, action: "typing" }, fetcher, 0);
}
