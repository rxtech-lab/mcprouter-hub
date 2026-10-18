import "server-only";
import { createHash } from "node:crypto";
import type { UIMessage } from "ai";
import { parseMcpServers, resolveServer } from "@/lib/agent/mcp-servers";
import { generateAgentReply } from "@/lib/agent/run";
import { SIGN_OUT_NOTE, signOutTool } from "@/lib/agent/sign-out-tool";
import { isOverLimit } from "@/lib/billing/allowance";
import { cardsForToolResults } from "@/lib/cards";
import { renderCardPng } from "@/lib/cards/render";
import { deleteChat, ensureChat, loadChat, saveMessages } from "@/lib/chat-store";
import { createLinkToken, findLink, phoneHash, signOutNumber } from "@/lib/whatsapp/link";
import { sendImage, sendText, sendTyping, toWhatsAppText, type IncomingMessage, type WhatsAppConfig } from "@/lib/whatsapp/wasender";
import type { Card } from "@/mcp/apps/card";

/** Earlier turns sent to the model with each question. */
const MAX_HISTORY = 20;
const MAX_QUESTION_CHARS = 2_000;
const RESET_COMMANDS = new Set(["/new", "/reset"]);
const SIGN_OUT_COMMANDS = new Set(["/signout", "/logout"]);

export const WHATSAPP_CHANNEL_NOTE = `You are replying in WhatsApp. Keep answers short and skimmable: plain sentences and "-" bullets, *bold* sparingly, no tables or headings.
The user can send "/new" to start a fresh conversation and "/signout" to unlink their mcprouter account.
${SIGN_OUT_NOTE}`;

type LinkedUser = { id: string; email: string };

/** The agent's text answer, pictures of the results of tools that have an MCP App, and whether it was asked to sign the user out. */
export type AgentAnswer = { text: string; cards: Card[]; signOut?: boolean };

/** One chat per account and number, so relinking a number to another account starts a fresh chat there. */
export function whatsAppChatId(userId: string, from: string) {
  return `wa-${createHash("sha256").update(`${userId}:${phoneHash(from)}`).digest("hex").slice(0, 32)}`;
}

export type BotDeps = {
  config: WhatsAppConfig;
  /** This deployment's public origin, for sign-in links and the agent's `self` MCP server. */
  origin: string;
  findUser?: (from: string) => Promise<LinkedUser | null>;
  signOut?: (from: string) => Promise<boolean>;
  overLimit?: (user: LinkedUser) => Promise<boolean>;
  reply?: (messages: UIMessage[], user: LinkedUser) => Promise<AgentAnswer>;
  send?: (to: string, text: string) => Promise<void>;
  sendCard?: (to: string, card: Card) => Promise<void>;
  typing?: (to: string) => Promise<void>;
};

async function linkedUser(from: string) {
  const link = await findLink(phoneHash(from));
  return link ? { id: link.userId, email: link.userEmail } : null;
}

function defaultReply(deps: BotDeps) {
  return async (messages: UIMessage[], user: LinkedUser): Promise<AgentAnswer> => {
    // The member's own agent, with the same servers and billing as the web chat.
    const servers = parseMcpServers(process.env.AGENT_MCP_SERVERS).map((server) =>
      resolveServer(server, { origin: deps.origin, userId: user.id, internalKey: process.env.MCPROUTER_INTERNAL_KEY, channel: "whatsapp" }),
    );
    const signOut = signOutTool();
    const { text, toolOutputs } = await generateAgentReply({ servers, messages, model: deps.config.model, channelNote: WHATSAPP_CHANNEL_NOTE, channelTools: signOut.tools });
    return { text, cards: cardsForToolResults(toolOutputs), signOut: signOut.requested() };
  };
}

const textMessage = (id: string, role: "user" | "assistant", text: string): UIMessage => ({ id, role, parts: [{ type: "text", text }] });

const INTRO = "Hi! I answer questions about Hong Kong with live government data: weather, buses, the MTR, A&E waiting times and more.";

export const SIGNED_OUT_LEAD = "Signed out. This number is no longer linked to mcprouter.";

/** `lead` replaces the greeting, e.g. after signing out. */
export function signInMessage(origin: string, from: string, lead = INTRO) {
  const link = `${origin}/whatsapp/link?token=${createLinkToken(from)}`;
  return `${lead}\n\nTo start, sign in to mcprouter and link this number (the link works for 30 minutes):\n${link}`;
}

/** Sent to the number once it's linked on the web. */
export function linkedMessage(email: string) {
  return `You're signed in${email ? ` as *${email}*` : ""}. Ask me anything about Hong Kong: weather, buses, the MTR, A&E waiting times and more.\n\nSend /new to start over, or /signout to unlink this number.`;
}

export function overLimitMessage(origin: string) {
  return `You've used up your mcprouter allowance, so I can't look anything up right now. Sign in to top up or change your plan:\n${origin}/login?next=${encodeURIComponent("/billing")}`;
}

/** Answers one incoming WhatsApp message. Never throws; failures are logged and, where possible, told to the user. */
export async function handleIncomingMessage(message: IncomingMessage, deps: BotDeps) {
  const send = deps.send ?? ((to, text) => sendText(deps.config, to, text));
  const typing = deps.typing ?? ((to) => sendTyping(deps.config, to));
  const sendCard = deps.sendCard ?? (async (to, card) => sendImage(deps.config, to, await renderCardPng(card)));
  const reply = deps.reply ?? defaultReply(deps);
  const findUser = deps.findUser ?? linkedUser;
  const signOut = deps.signOut ?? ((from: string) => signOutNumber(phoneHash(from)));
  const overLimit = deps.overLimit ?? isOverLimit;

  try {
    if (message.text !== null && SIGN_OUT_COMMANDS.has(message.text.trim().toLowerCase())) {
      const signedOut = await signOut(message.from);
      await send(message.from, signedOut ? signInMessage(deps.origin, message.from, SIGNED_OUT_LEAD) : "This number isn't linked to mcprouter, so there's nothing to sign out of.");
      return { status: "signed-out" as const };
    }

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
    let wantsSignOut = false;
    try {
      const result = await reply([...history.slice(-MAX_HISTORY), question], user);
      answer = result.text.trim();
      wantsSignOut = Boolean(result.signOut);
      // Pictures of the tool results go first, so the text answer reads as their summary.
      for (const card of result.cards) {
        await sendCard(message.from, card).catch((error) => console.warn("[whatsapp] could not send a card", card.title, error));
      }
    } catch (error) {
      console.error("[whatsapp] agent failed", error);
      await send(message.from, "Sorry, I couldn't answer that just now. Please try again in a moment.");
      return { status: "failed" as const };
    }
    if (!answer && !wantsSignOut) answer = "Sorry, I couldn't find an answer to that.";

    if (answer) {
      await send(message.from, toWhatsAppText(answer));
      await saveMessages(chatId, [textMessage(`msg_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`, "assistant", answer)], history.length + 1);
    }
    // Asked in their own words ("log me out"): unlink like /signout, once the reply is saved.
    if (wantsSignOut) {
      await signOut(message.from);
      await send(message.from, signInMessage(deps.origin, message.from, SIGNED_OUT_LEAD));
      return { status: "signed-out" as const };
    }
    return { status: "answered" as const };
  } catch (error) {
    console.error("[whatsapp] could not handle message", message.id, error);
    return { status: "failed" as const };
  }
}
