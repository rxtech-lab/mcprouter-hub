import "server-only";
import { createHash } from "node:crypto";
import type { UIMessage } from "ai";
import { parseMcpServers, resolveServer } from "@/lib/agent/mcp-servers";
import { generateAgentReply } from "@/lib/agent/run";
import { isOverLimit } from "@/lib/billing/allowance";
import { deleteChat, ensureChat, loadChat, saveMessages } from "@/lib/chat-store";
import { createLinkToken, findLink, phoneHash } from "@/lib/whatsapp/link";
import { sendText, sendTyping, toWhatsAppText, type IncomingMessage, type WhatsAppConfig } from "@/lib/whatsapp/wasender";

/** Earlier turns sent to the model with each question. */
const MAX_HISTORY = 20;
const MAX_QUESTION_CHARS = 2_000;
const RESET_COMMANDS = new Set(["/new", "/reset"]);

export const WHATSAPP_CHANNEL_NOTE = `You are replying in WhatsApp. Keep answers short and skimmable: plain sentences and "-" bullets, *bold* sparingly, no tables or headings.
The user can send "/new" to start a fresh conversation.`;

type LinkedUser = { id: string; email: string };

/** One chat per account and number, so relinking a number to another account starts a fresh chat there. */
export function whatsAppChatId(userId: string, from: string) {
  return `wa-${createHash("sha256").update(`${userId}:${phoneHash(from)}`).digest("hex").slice(0, 32)}`;
}

export type BotDeps = {
  config: WhatsAppConfig;
  /** This deployment's public origin, for sign-in links and the agent's `self` MCP server. */
  origin: string;
  findUser?: (from: string) => Promise<LinkedUser | null>;
  overLimit?: (user: LinkedUser) => Promise<boolean>;
  reply?: (messages: UIMessage[], user: LinkedUser) => Promise<string>;
  send?: (to: string, text: string) => Promise<void>;
  typing?: (to: string) => Promise<void>;
};

async function linkedUser(from: string) {
  const link = await findLink(phoneHash(from));
  return link ? { id: link.userId, email: link.userEmail } : null;
}

function defaultReply(deps: BotDeps) {
  return (messages: UIMessage[], user: LinkedUser) => {
    // The member's own agent, with the same servers and billing as the web chat.
    const servers = parseMcpServers(process.env.AGENT_MCP_SERVERS).map((server) =>
      resolveServer(server, { origin: deps.origin, userId: user.id, internalKey: process.env.MCPROUTER_INTERNAL_KEY }),
    );
    return generateAgentReply({ servers, messages, model: deps.config.model, channelNote: WHATSAPP_CHANNEL_NOTE });
  };
}

const textMessage = (id: string, role: "user" | "assistant", text: string): UIMessage => ({ id, role, parts: [{ type: "text", text }] });

export function signInMessage(origin: string, from: string) {
  const link = `${origin}/whatsapp/link?token=${createLinkToken(from)}`;
  return `Hi! I answer questions about Hong Kong with live government data: weather, buses, the MTR, A&E waiting times and more.\n\nTo start, sign in to mcprouter and link this number (the link works for 30 minutes):\n${link}`;
}

export function overLimitMessage(origin: string) {
  return `You've used up your mcprouter allowance, so I can't look anything up right now. Sign in to top up or change your plan:\n${origin}/login?next=${encodeURIComponent("/billing")}`;
}

/** Answers one incoming WhatsApp message. Never throws; failures are logged and, where possible, told to the user. */
export async function handleIncomingMessage(message: IncomingMessage, deps: BotDeps) {
  const send = deps.send ?? ((to, text) => sendText(deps.config, to, text));
  const typing = deps.typing ?? ((to) => sendTyping(deps.config, to));
  const reply = deps.reply ?? defaultReply(deps);
  const findUser = deps.findUser ?? linkedUser;
  const overLimit = deps.overLimit ?? isOverLimit;

  try {
    const user = await findUser(message.from);
    if (!user) {
      await send(message.from, signInMessage(deps.origin, message.from));
      return { status: "sign-in" as const };
    }

    const chatId = whatsAppChatId(user.id, message.from);
    const existing = await loadChat(user.id, chatId);
    // Webhooks can be redelivered; the message id is already stored then.
    if (existing?.messages.some((stored) => stored.id === message.id)) return { status: "duplicate" as const };

    if (message.text === null) {
      await send(message.from, "I can only read text messages for now. Ask me about Hong Kong weather, buses, the MTR, A&E waiting times or public holidays.");
      return { status: "unsupported" as const };
    }
    const text = message.text.trim();
    if (RESET_COMMANDS.has(text.toLowerCase())) {
      if (existing) await deleteChat(user.id, chatId);
      await send(message.from, "Started a new conversation. What would you like to know?");
      return { status: "reset" as const };
    }
    if (text.length > MAX_QUESTION_CHARS) {
      await send(message.from, `Please keep questions under ${MAX_QUESTION_CHARS} characters.`);
      return { status: "too-long" as const };
    }

    if (await overLimit(user)) {
      await send(message.from, overLimitMessage(deps.origin));
      return { status: "limited" as const };
    }

    await typing(message.from).catch((error) => console.warn("[whatsapp] typing indicator failed", error));

    const question = textMessage(message.id, "user", text);
    const history = existing?.messages ?? [];
    await ensureChat(user.id, chatId, question);
    await saveMessages(chatId, [question], history.length);

    let answer: string;
    try {
      answer = (await reply([...history.slice(-MAX_HISTORY), question], user)).trim();
    } catch (error) {
      console.error("[whatsapp] agent failed", error);
      await send(message.from, "Sorry, I couldn't answer that just now. Please try again in a moment.");
      return { status: "failed" as const };
    }
    if (!answer) answer = "Sorry, I couldn't find an answer to that.";

    await send(message.from, toWhatsAppText(answer));
    await saveMessages(chatId, [textMessage(`msg_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`, "assistant", answer)], history.length + 1);
    return { status: "answered" as const };
  } catch (error) {
    console.error("[whatsapp] could not handle message", message.id, error);
    return { status: "failed" as const };
  }
}
