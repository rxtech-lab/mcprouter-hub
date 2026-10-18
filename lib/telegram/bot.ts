import "server-only";
import { createHash } from "node:crypto";
import type { UIMessage } from "ai";
import type { ToolMode } from "@/db/schema";
import { parseMcpServers, resolveServer } from "@/lib/agent/mcp-servers";
import { generateAgentReply } from "@/lib/agent/run";
import { SIGN_OUT_NOTE, signOutTool } from "@/lib/agent/sign-out-tool";
import { isOverLimit } from "@/lib/billing/allowance";
import { cardsForVisuals } from "@/lib/cards";
import { renderCardPng } from "@/lib/cards/render";
import { deleteChat, ensureChat, loadChat, saveMessages } from "@/lib/chat-store";
import { commandOf, sendPhoto, sendText, sendTyping, type IncomingMessage, type LinkButton, type TelegramConfig } from "@/lib/telegram/api";
import type { Card } from "@/mcp/apps/card";
import { createLinkToken, findLink, signOutAccount, telegramHash } from "@/lib/telegram/link";

/** Earlier turns sent to the model with each question. */
const MAX_HISTORY = 20;
const MAX_QUESTION_CHARS = 2_000;
const RESET_COMMANDS = new Set(["/new", "/reset"]);
const SIGN_OUT_COMMANDS = new Set(["/signout", "/logout"]);
/** Telegram drops "typing…" after 5 seconds, so it's sent again while the agent works. */
const TYPING_INTERVAL_MS = 4_000;

export const TELEGRAM_CHANNEL_NOTE = `You are replying in Telegram. Keep answers short and skimmable: plain sentences and "-" bullets, **bold** sparingly, no tables or headings.
The user can send "/new" to start a fresh conversation and "/signout" to unlink their mcprouter account.
${SIGN_OUT_NOTE}`;

const INTRO = "Hi! I answer questions with live open data, starting with Hong Kong: weather, buses, the MTR, A&E waiting times and more.";

/** `scopes` are the services the link may call; empty means every service. `toolMode` is how the agent sees them. */
type LinkedUser = { id: string; email: string; scopes?: string[]; toolMode?: ToolMode | null };

/** The agent's text answer, pictures of the results of tools that have an MCP App, and whether it was asked to sign the user out. */
export type AgentAnswer = { text: string; cards: Card[]; signOut?: boolean };

/** One chat per account and Telegram user, so relinking to another account starts a fresh chat there. */
export function telegramChatId(userId: string, from: string) {
  return `tg-${createHash("sha256").update(`${userId}:${telegramHash(from)}`).digest("hex").slice(0, 32)}`;
}

export type BotDeps = {
  config: TelegramConfig;
  /** This deployment's public origin, for sign-in links and the agent's `self` MCP server. */
  origin: string;
  findUser?: (from: string) => Promise<LinkedUser | null>;
  signOut?: (from: string) => Promise<boolean>;
  overLimit?: (user: LinkedUser) => Promise<boolean>;
  reply?: (messages: UIMessage[], user: LinkedUser) => Promise<AgentAnswer>;
  send?: (chatId: number, text: string, button?: LinkButton) => Promise<void>;
  sendCard?: (chatId: number, card: Card) => Promise<void>;
  typing?: (chatId: number) => Promise<void>;
};

async function linkedUser(from: string) {
  const link = await findLink(telegramHash(from));
  return link ? { id: link.userId, email: link.userEmail, scopes: link.scopes, toolMode: link.toolMode } : null;
}

function defaultReply(deps: BotDeps) {
  return async (messages: UIMessage[], user: LinkedUser): Promise<AgentAnswer> => {
    // The member's own agent, with the same servers and billing as the web chat.
    const servers = parseMcpServers(process.env.AGENT_MCP_SERVERS).map((server) =>
      resolveServer(server, { origin: deps.origin, userId: user.id, internalKey: process.env.MCPROUTER_INTERNAL_KEY, channel: "telegram", scopes: user.scopes, toolMode: user.toolMode }),
    );
    const signOut = signOutTool();
    const { text, visuals } = await generateAgentReply({ servers, messages, model: deps.config.model, channelNote: TELEGRAM_CHANNEL_NOTE, channelTools: signOut.tools });
    return { text, cards: cardsForVisuals(visuals), signOut: signOut.requested() };
  };
}

const textMessage = (id: string, role: "user" | "assistant", text: string): UIMessage => ({ id, role, parts: [{ type: "text", text }] });

/** Telegram only accepts public https URLs on buttons, so local http origins get the link in the text alone. */
const buttonFor = (text: string, url: string): LinkButton | undefined => (url.startsWith("https://") ? { text, url } : undefined);

/** `lead` replaces the greeting, e.g. after signing out. */
export function signInMessage(origin: string, message: Pick<IncomingMessage, "from" | "name" | "chatId">, lead = INTRO) {
  const url = `${origin}/telegram/link?token=${createLinkToken(message.from, message.name, message.chatId)}`;
  return {
    text: `${lead}\n\nTo start, sign in to mcprouter and link this Telegram account (the link works for 30 minutes):\n${url}`,
    button: buttonFor("Sign in and link", url),
  };
}

/** Sent to the chat once the account is linked on the web. */
export function linkedMessage(email: string) {
  return `You're signed in${email ? ` as **${email}**` : ""}. Ask me about live data, starting with Hong Kong: weather, buses, the MTR, A&E waiting times and more.\n\nSend /new to start over, or /signout to unlink this Telegram account.`;
}

export const SIGNED_OUT_LEAD = "Signed out. This Telegram account is no longer linked to mcprouter.";

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
  const sendCard = deps.sendCard ?? (async (chatId, card) => sendPhoto(deps.config, chatId, await renderCardPng(card)));
  const reply = deps.reply ?? defaultReply(deps);
  const findUser = deps.findUser ?? linkedUser;
  const signOut = deps.signOut ?? ((from: string) => signOutAccount(telegramHash(from)));
  const overLimit = deps.overLimit ?? isOverLimit;
  const to = message.chatId;

  try {
    if (message.text !== null && SIGN_OUT_COMMANDS.has(commandOf(message.text) ?? "")) {
      if (!(await signOut(message.from))) {
        await send(to, "This Telegram account isn't linked to mcprouter, so there's nothing to sign out of.");
        return { status: "signed-out" as const };
      }
      const { text, button } = signInMessage(deps.origin, message, SIGNED_OUT_LEAD);
      await send(to, text, button);
      return { status: "signed-out" as const };
    }

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
      await send(to, "I can only read text messages for now. Ask me about the weather, buses, the MTR, A&E waiting times or public holidays.");
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
      await send(to, `${INTRO}\n\nYour account is linked, so just ask. Send /new to start over or /signout to unlink.`);
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
    let wantsSignOut = false;
    const stopTyping = keepTyping(typing, to);
    try {
      const result = await reply([...history.slice(-MAX_HISTORY), question], user);
      answer = result.text.trim();
      wantsSignOut = Boolean(result.signOut);
      // Pictures of the tool results go first, so the text answer reads as their summary.
      for (const card of result.cards) {
        await sendCard(to, card).catch((error) => console.warn("[telegram] could not send a card", card.title, error));
      }
    } catch (error) {
      console.error("[telegram] agent failed", error);
      await send(to, "Sorry, I couldn't answer that just now. Please try again in a moment.");
      return { status: "failed" as const };
    } finally {
      stopTyping();
    }
    if (!answer && !wantsSignOut) answer = "Sorry, I couldn't find an answer to that.";

    if (answer) {
      await send(to, answer);
      await saveMessages(chatId, [textMessage(`msg_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`, "assistant", answer)], history.length + 1);
    }
    // Asked in their own words ("log me out"): unlink like /signout, once the reply is saved.
    if (wantsSignOut) {
      await signOut(message.from);
      const { text: signInText, button } = signInMessage(deps.origin, message, SIGNED_OUT_LEAD);
      await send(to, signInText, button);
      return { status: "signed-out" as const };
    }
    return { status: "answered" as const };
  } catch (error) {
    console.error("[telegram] could not handle message", message.id, error);
    return { status: "failed" as const };
  }
}
