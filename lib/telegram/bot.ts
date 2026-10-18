import "server-only";
import { createHash } from "node:crypto";
import type { UIMessage } from "ai";
import { parseMcpServers, resolveServer } from "@/lib/agent/mcp-servers";
import { generateAgentReply } from "@/lib/agent/run";
import { isOverLimit } from "@/lib/billing/allowance";
import { deleteChat, ensureChat, loadChat, saveMessages } from "@/lib/chat-store";
import { commandOf, sendText, sendTyping, type IncomingMessage, type LinkButton, type TelegramConfig } from "@/lib/telegram/api";
import { createLinkToken, findLink, telegramHash } from "@/lib/telegram/link";

/** Earlier turns sent to the model with each question. */
const MAX_HISTORY = 20;
const MAX_QUESTION_CHARS = 2_000;
const RESET_COMMANDS = new Set(["/new", "/reset"]);
/** Telegram drops "typing…" after 5 seconds, so it's sent again while the agent works. */
const TYPING_INTERVAL_MS = 4_000;

export const TELEGRAM_CHANNEL_NOTE = `You are replying in Telegram. Keep answers short and skimmable: plain sentences and "-" bullets, **bold** sparingly, no tables or headings.
The user can send "/new" to start a fresh conversation.`;

const INTRO = "Hi! I answer questions about Hong Kong with live government data: weather, buses, the MTR, A&E waiting times and more.";

type LinkedUser = { id: string; email: string };

/** One chat per account and Telegram user, so relinking to another account starts a fresh chat there. */
export function telegramChatId(userId: string, from: string) {
  return `tg-${createHash("sha256").update(`${userId}:${telegramHash(from)}`).digest("hex").slice(0, 32)}`;
}

export type BotDeps = {
  config: TelegramConfig;
  /** This deployment's public origin, for sign-in links and the agent's `self` MCP server. */
  origin: string;
  findUser?: (from: string) => Promise<LinkedUser | null>;
  overLimit?: (user: LinkedUser) => Promise<boolean>;
  reply?: (messages: UIMessage[], user: LinkedUser) => Promise<string>;
  send?: (chatId: number, text: string, button?: LinkButton) => Promise<void>;
  typing?: (chatId: number) => Promise<void>;
};

async function linkedUser(from: string) {
  const link = await findLink(telegramHash(from));
  return link ? { id: link.userId, email: link.userEmail } : null;
}

function defaultReply(deps: BotDeps) {
  return (messages: UIMessage[], user: LinkedUser) => {
    // The member's own agent, with the same servers and billing as the web chat.
    const servers = parseMcpServers(process.env.AGENT_MCP_SERVERS).map((server) =>
      resolveServer(server, { origin: deps.origin, userId: user.id, internalKey: process.env.MCPROUTER_INTERNAL_KEY }),
    );
    return generateAgentReply({ servers, messages, model: deps.config.model, channelNote: TELEGRAM_CHANNEL_NOTE });
  };
}

const textMessage = (id: string, role: "user" | "assistant", text: string): UIMessage => ({ id, role, parts: [{ type: "text", text }] });

/** Telegram only accepts public https URLs on buttons, so local http origins get the link in the text alone. */
const buttonFor = (text: string, url: string): LinkButton | undefined => (url.startsWith("https://") ? { text, url } : undefined);

export function signInMessage(origin: string, message: Pick<IncomingMessage, "from" | "name">) {
  const url = `${origin}/telegram/link?token=${createLinkToken(message.from, message.name)}`;
  return {
    text: `${INTRO}\n\nTo start, sign in to mcprouter and link this Telegram account (the link works for 30 minutes):\n${url}`,
    button: buttonFor("Sign in and link", url),
  };
}

export function overLimitMessage(origin: string) {
  const url = `${origin}/login?next=${encodeURIComponent("/billing")}`;
  return {
    text: `You've used up your mcprouter allowance, so I can't look anything up right now. Sign in to top up or change your plan:\n${url}`,
    button: buttonFor("Open billing", url),
  };
}

/** Keeps "typing…" showing until the returned function is called. */
function keepTyping(typing: (chatId: number) => Promise<void>, chatId: number) {
  const tick = () => void typing(chatId).catch((error) => console.warn("[telegram] typing indicator failed", error));
  tick();
  const timer = setInterval(tick, TYPING_INTERVAL_MS);
  return () => clearInterval(timer);
}

/** Answers one incoming Telegram message. Never throws; failures are logged and, where possible, told to the user. */
export async function handleIncomingMessage(message: IncomingMessage, deps: BotDeps) {
  const send = deps.send ?? ((chatId, text, button) => sendText(deps.config, chatId, text, button));
  const typing = deps.typing ?? ((chatId) => sendTyping(deps.config, chatId));
  const reply = deps.reply ?? defaultReply(deps);
  const findUser = deps.findUser ?? linkedUser;
  const overLimit = deps.overLimit ?? isOverLimit;
  const to = message.chatId;

  try {
    const user = await findUser(message.from);
    if (!user) {
      const { text, button } = signInMessage(deps.origin, message);
      await send(to, text, button);
      return { status: "sign-in" as const };
    }

    const chatId = telegramChatId(user.id, message.from);
    const existing = await loadChat(user.id, chatId);
    // Telegram redelivers updates it didn't see acknowledged; the message id is already stored then.
    if (existing?.messages.some((stored) => stored.id === message.id)) return { status: "duplicate" as const };

    if (message.text === null) {
      await send(to, "I can only read text messages for now. Ask me about Hong Kong weather, buses, the MTR, A&E waiting times or public holidays.");
      return { status: "unsupported" as const };
    }
    const text = message.text.trim();
    const command = commandOf(text);
    if (command && RESET_COMMANDS.has(command)) {
      if (existing) await deleteChat(user.id, chatId);
      await send(to, "Started a new conversation. What would you like to know?");
      return { status: "reset" as const };
    }
    if (command === "/start") {
      await send(to, `${INTRO}\n\nYour account is linked, so just ask. Send /new to start over.`);
      return { status: "welcome" as const };
    }
    if (text.length > MAX_QUESTION_CHARS) {
      await send(to, `Please keep questions under ${MAX_QUESTION_CHARS} characters.`);
      return { status: "too-long" as const };
    }

    if (await overLimit(user)) {
      const { text: limitText, button } = overLimitMessage(deps.origin);
      await send(to, limitText, button);
      return { status: "limited" as const };
    }

    const question = textMessage(message.id, "user", text);
    const history = existing?.messages ?? [];
    await ensureChat(user.id, chatId, question);
    await saveMessages(chatId, [question], history.length);

    let answer: string;
    const stopTyping = keepTyping(typing, to);
    try {
      answer = (await reply([...history.slice(-MAX_HISTORY), question], user)).trim();
    } catch (error) {
      console.error("[telegram] agent failed", error);
      await send(to, "Sorry, I couldn't answer that just now. Please try again in a moment.");
      return { status: "failed" as const };
    } finally {
      stopTyping();
    }
    if (!answer) answer = "Sorry, I couldn't find an answer to that.";

    await send(to, answer);
    await saveMessages(chatId, [textMessage(`msg_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`, "assistant", answer)], history.length + 1);
    return { status: "answered" as const };
  } catch (error) {
    console.error("[telegram] could not handle message", message.id, error);
    return { status: "failed" as const };
  }
}
