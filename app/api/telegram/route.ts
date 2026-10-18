import { after } from "next/server";
import { siteUrl } from "@/lib/site";
import { parseUpdate, telegramConfig, verifySecretToken } from "@/lib/telegram/api";
import { handleIncomingMessage } from "@/lib/telegram/bot";

/** Replies are generated after the webhook is acknowledged, within this budget. */
export const maxDuration = 120;

const plain = (message: string, status: number) => new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/** Telegram bot webhook. Acknowledged at once so the update isn't redelivered; the agent answers afterwards. */
export async function POST(request: Request) {
  const config = telegramConfig();
  if (!config.enabled || !config.webhookSecret) return plain("Telegram is not configured.", 404);
  if (!verifySecretToken(request.headers.get("x-telegram-bot-api-secret-token"), config.webhookSecret)) return plain("Invalid secret token.", 401);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return plain("Bad request.", 400);
  }

  const message = parseUpdate(payload);
  if (message) {
    const origin = await siteUrl();
    after(() => handleIncomingMessage(message, { config, origin }));
  }
  return plain("OK", 200);
}
