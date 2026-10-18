/**
 * Points the Telegram bot at this deployment's webhook and sets its command menu.
 *   bun scripts/telegram-webhook.ts [https://<site>]
 * The URL defaults to NEXT_PUBLIC_SITE_URL. Telegram only calls public https URLs,
 * so for local work pass a tunnel URL (e.g. from `cloudflared tunnel --url http://localhost:3000`).
 */
import { config as loadEnv } from "dotenv";
import { callTelegram, telegramConfig } from "../lib/telegram/api";

loadEnv({ path: ".env" });

const config = telegramConfig();
if (!config.enabled) throw new Error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET first.");
const origin = (process.argv[2] ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
if (!origin.startsWith("https://")) throw new Error(`Telegram needs a public https URL, got "${origin || "nothing"}".`);

const url = `${origin}/api/telegram`;
await callTelegram(config, "setWebhook", { url, secret_token: config.webhookSecret, allowed_updates: ["message"], drop_pending_updates: true });
await callTelegram(config, "setMyCommands", {
  commands: [
    { command: "new", description: "Start a new conversation" },
    { command: "signout", description: "Unlink this Telegram account" },
  ],
});
const me = (await callTelegram(config, "getMe", {})) as { username?: string };
console.log(`Webhook set to ${url} for @${me.username}.`);
if (config.botUsername !== me.username) console.log(`Set TELEGRAM_BOT_USERNAME=${me.username} for "Chat on Telegram" links.`);
