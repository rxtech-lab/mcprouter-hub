import { after } from "next/server";
import { siteUrl } from "@/lib/site";
import { handleIncomingMessage } from "@/lib/whatsapp/bot";
import { parseIncomingMessages, verifySignature, whatsAppConfig } from "@/lib/whatsapp/wasender";

/** Replies are generated after the webhook is acknowledged, within this budget. */
export const maxDuration = 120;

const plain = (message: string, status: number) => new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/** WasenderAPI webhook. Acknowledged at once so it isn't redelivered; the agent answers afterwards. */
export async function POST(request: Request) {
  const config = whatsAppConfig();
  if (!config.enabled || !config.webhookSecret) return plain("WhatsApp is not configured.", 404);
  if (!verifySignature(request.headers.get("x-webhook-signature"), config.webhookSecret)) return plain("Invalid signature.", 401);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return plain("Bad request.", 400);
  }

  const messages = parseIncomingMessages(payload);
  if (messages.length > 0) {
    const origin = await siteUrl();
    after(async () => {
      // One sender's messages are answered in order; different senders in parallel.
      const bySender = Map.groupBy(messages, (message) => message.from);
      await Promise.all(
        [...bySender.values()].map(async (queue) => {
          for (const message of queue) await handleIncomingMessage(message, { config, origin });
        }),
      );
    });
  }
  return plain("OK", 200);
}
