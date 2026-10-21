import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { UsageLimitError } from "@/lib/billing/errors";
import { db } from "@/db";
import { POST } from "@/app/api/whatsapp/route";
import { loadChat } from "@/lib/chat-store";
import { handleIncomingMessage, linkedMessage, whatsAppChatId, type BotDeps } from "@/lib/whatsapp/bot";
import { createLinkToken, findLink, LINK_TOKEN_TTL_MS, linkNumber, listLinks, phoneHash, readLinkToken, signOutNumber, unlinkNumber } from "@/lib/whatsapp/link";
import { parseIncomingMessages, sendImage, sendText, splitMessage, toWhatsAppText, verifySignature, whatsAppConfig, type IncomingMessage } from "@/lib/whatsapp/wasender";
import type { Card } from "@/mcp/apps/card";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "hub.test" }) }));

beforeAll(async () => {
  vi.stubEnv("AUTH_SECRET", "test-secret");
  await migrate(db, { migrationsFolder: "db/migrations" });
});

const env = { WASENDER_API_KEY: "key", WASENDER_WEBHOOK_SECRET: "hook-secret" };

function received(messages: object | object[], event = "messages.received") {
  return { event, timestamp: 1633456789, data: { messages } };
}

const textFrom = (id: string, from: string, body: string, key: object = {}) => ({
  key: { id, fromMe: false, remoteJid: `${from}@s.whatsapp.net`, senderPn: `${from}@s.whatsapp.net`, cleanedSenderPn: from, ...key },
  messageBody: body,
  message: { conversation: body },
});

describe("whatsAppConfig", () => {
  it("is off until the API key and webhook secret are both set", () => {
    expect(whatsAppConfig({}).enabled).toBe(false);
    expect(whatsAppConfig({ WASENDER_API_KEY: "key" }).enabled).toBe(false);
    expect(whatsAppConfig({ ...env, AI_MODEL: "openai/gpt-5" })).toMatchObject({ enabled: true, model: "openai/gpt-5" });
    expect(whatsAppConfig({ ...env, AI_MODEL: "openai/gpt-5", WHATSAPP_MODEL: "x/y" }).model).toBe("x/y");
  });
});

describe("verifySignature", () => {
  it("accepts only the exact webhook secret", () => {
    expect(verifySignature("hook-secret", "hook-secret")).toBe(true);
    expect(verifySignature("hook-secreT", "hook-secret")).toBe(false);
    expect(verifySignature("hook", "hook-secret")).toBe(false);
    expect(verifySignature(null, "hook-secret")).toBe(false);
  });
});

describe("parseIncomingMessages", () => {
  it("reads one-to-one text messages and marks other types unreadable", () => {
    const image = { key: { id: "m2", fromMe: false, remoteJid: "85291234567@s.whatsapp.net", cleanedSenderPn: "85291234567" }, message: { imageMessage: {} } };
    expect(parseIncomingMessages(received(textFrom("m1", "85291234567", "Weather?")))).toEqual([{ id: "m1", from: "85291234567", text: "Weather?" }]);
    expect(parseIncomingMessages(received([image]))).toEqual([{ id: "m2", from: "85291234567", text: null }]);
  });

  it("takes the number from senderPn when the chat uses a LID", () => {
    const lid = textFrom("m3", "85291234567", "Hi", { remoteJid: "555555555@lid", cleanedSenderPn: undefined });
    expect(parseIncomingMessages(received(lid))).toEqual([{ id: "m3", from: "85291234567", text: "Hi" }]);
  });

  it("ignores the bot's own messages, groups, other events and junk", () => {
    expect(parseIncomingMessages(received(textFrom("m4", "85291234567", "Hi", { fromMe: true }), "messages.upsert"))).toEqual([]);
    expect(parseIncomingMessages(received(textFrom("m5", "85291234567", "Hi", { remoteJid: "1203630@g.us" })))).toEqual([]);
    expect(parseIncomingMessages({ event: "session.status", data: { status: "connected" } })).toEqual([]);
    expect(parseIncomingMessages(null)).toEqual([]);
  });
});

describe("toWhatsAppText", () => {
  it("converts markdown to WhatsApp formatting", () => {
    const markdown = ["## Weather", "It's **24°C** and *sunny*, ~~no rain~~.", "- Humidity 70%", "* UV 5", "More at [HKO](https://www.hko.gov.hk).", "| a | b |", "|---|---|", "| 1 | 2 |"].join("\n");
    expect(toWhatsAppText(markdown)).toBe(
      ["*Weather*", "It's *24°C* and _sunny_, ~no rain~.", "• Humidity 70%", "• UV 5", "More at HKO (https://www.hko.gov.hk).", "| a | b |", "", "| 1 | 2 |"].join("\n"),
    );
  });

  it("leaves arithmetic and code alone", () => {
    expect(toWhatsAppText("2 * 3 * 4 = 24")).toBe("2 * 3 * 4 = 24");
    expect(toWhatsAppText("```\nkmb_eta\n```")).toBe("```\nkmb_eta\n```");
  });
});

describe("splitMessage", () => {
  it("keeps short replies whole and splits long ones on paragraph breaks", () => {
    expect(splitMessage("hello")).toEqual(["hello"]);
    expect(splitMessage(`${"a".repeat(70)}\n\n${"b".repeat(50)}`, 100)).toEqual(["a".repeat(70), "b".repeat(50)]);
  });

  it("cuts unbroken text at the limit", () => {
    expect(splitMessage("x".repeat(250), 100).map((chunk) => chunk.length)).toEqual([100, 100, 50]);
  });
});

describe("sendText", () => {
  it("posts each chunk to send-message with the session key", async () => {
    const fetcher = vi.fn(async () => new Response('{"success":true}', { status: 200 }));
    await sendText(whatsAppConfig(env), "85291234567", `${"a".repeat(4000)}\n\n${"b".repeat(200)}`, fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://www.wasenderapi.com/api/send-message");
    expect(init.headers).toMatchObject({ Authorization: "Bearer key" });
    expect(JSON.parse(init.body as string)).toEqual({ to: "+85291234567", text: "a".repeat(4000) });
  });

  it("retries once when rate limited, then throws with the API's error", async () => {
    const limited = () => new Response("slow down", { status: 429, headers: { "retry-after": "0.001" } });
    const ok = vi.fn().mockResolvedValueOnce(limited()).mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await sendText(whatsAppConfig(env), "1", "hi", ok as unknown as typeof fetch);
    expect(ok).toHaveBeenCalledTimes(2);
    const failing = vi.fn(async () => new Response('{"message":"bad key"}', { status: 401 }));
    await expect(sendText(whatsAppConfig(env), "1", "hi", failing as unknown as typeof fetch)).rejects.toThrow("WasenderAPI 401");
  });
});

describe("sendImage", () => {
  it("uploads the PNG, then sends its public URL", async () => {
    const fetcher = vi
      .fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({ success: true }))
      .mockResolvedValueOnce(Response.json({ success: true, publicUrl: "https://wasenderapi.com/media/card.png" }));
    await sendImage(whatsAppConfig(env), "85291234567", new Uint8Array([137, 80, 78, 71]), fetcher as unknown as typeof fetch);
    expect(fetcher.mock.calls[0][0]).toBe("https://www.wasenderapi.com/api/upload");
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual({ base64: "data:image/png;base64,iVBORw==" });
    expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string)).toEqual({ to: "+85291234567", imageUrl: "https://wasenderapi.com/media/card.png" });
  });

  it("refuses to send when the upload returns no URL", async () => {
    const fetcher = vi.fn(async () => Response.json({ success: false }));
    await expect(sendImage(whatsAppConfig(env), "1", new Uint8Array([1]), fetcher as unknown as typeof fetch)).rejects.toThrow("publicUrl");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("linkedMessage", () => {
  it("confirms the account in WhatsApp formatting", () => {
    expect(linkedMessage("ada@test")).toContain("*ada@test*");
  });
});

describe("link tokens", () => {
  it("round-trips the number's hash and last digits until it expires", () => {
    const now = Date.now();
    const token = createLinkToken("85291234567", now);
    expect(token).not.toContain("85291234567");
    expect(Buffer.from(token.split(".")[0], "base64url").toString()).not.toContain("85291234567");
    expect(readLinkToken(token, now)).toEqual({ phoneHash: phoneHash("85291234567"), phoneHint: "4567", phone: "85291234567", expiresAt: now + LINK_TOKEN_TTL_MS });
    expect(readLinkToken(token, now + LINK_TOKEN_TTL_MS + 1)).toBeNull();
  });

  it("rejects tampered and malformed tokens", () => {
    const [payload, signature] = createLinkToken("85291234567").split(".");
    const forged = Buffer.from(JSON.stringify({ h: phoneHash("85200000000"), d: "0000", e: Date.now() + 60_000 })).toString("base64url");
    expect(readLinkToken(`${forged}.${signature}`)).toBeNull();
    expect(readLinkToken(`${payload}.x`)).toBeNull();
    expect(readLinkToken(payload)).toBeNull();
    expect(readLinkToken(null)).toBeNull();
  });
});

describe("linked numbers", () => {
  it("links a number to one account at a time and unlinks only for its owner", async () => {
    const claims = readLinkToken(createLinkToken("85298887777"))!;
    await linkNumber({ id: "alice", email: "alice@test" }, claims);
    expect(await findLink(claims.phoneHash)).toMatchObject({ userId: "alice", userEmail: "alice@test", phoneHint: "7777" });

    await linkNumber({ id: "bob", email: "bob@test" }, claims);
    expect((await findLink(claims.phoneHash))?.userId).toBe("bob");
    expect(await listLinks("alice")).toEqual([]);

    await expect(unlinkNumber("alice", claims.phoneHash)).rejects.toThrow("NOT_FOUND");
    await unlinkNumber("bob", claims.phoneHash);
    expect(await findLink(claims.phoneHash)).toBeNull();
  });

  it("signs out from whichever account the number is linked to", async () => {
    const claims = readLinkToken(createLinkToken("85298886666"))!;
    await linkNumber({ id: "carol", email: "carol@test" }, claims);
    expect(await signOutNumber(claims.phoneHash)).toBe(true);
    expect(await findLink(claims.phoneHash)).toBeNull();
    expect(await signOutNumber(claims.phoneHash)).toBe(false);
  });
});

describe("handleIncomingMessage", () => {
  let counter = 0;
  function setup(overrides: Partial<BotDeps> = {}) {
    const from = `852900000${String(++counter).padStart(2, "0")}`;
    const user = { id: `user-${counter}`, email: `user${counter}@test` };
    const sent: string[] = [];
    const reply = vi.fn<NonNullable<BotDeps["reply"]>>(async (messages) => ({ text: `**Answer** ${messages.length}`, cards: [] }));
    const deps: BotDeps = {
      config: whatsAppConfig(env),
      origin: "https://hub.test",
      findUser: async () => user,
      consumeChat: async () => undefined,
      reply,
      send: async (_to, text) => void sent.push(text),
      typing: async () => {},
      ...overrides,
    };
    const message = (id: string, text: string | null): IncomingMessage => ({ id, from, text });
    return { from, user, sent, reply, deps, message };
  }

  it("sends a sign-in link to numbers that aren't linked", async () => {
    const { from, sent, reply, deps, message } = setup({ findUser: async () => null });
    expect(await handleIncomingMessage(message("a0", "Weather?"), deps)).toEqual({ status: "sign-in" });
    expect(reply).not.toHaveBeenCalled();
    const token = new URL(sent[0].match(/https:\/\/\S+/)![0]).searchParams.get("token");
    expect(sent[0]).toContain("https://hub.test/whatsapp/link?token=");
    expect(readLinkToken(token)?.phoneHash).toBe(phoneHash(from));
  });

  it("answers as the linked user and saves the chat in their history", async () => {
    const { from, user, sent, reply, deps, message } = setup();
    expect(await handleIncomingMessage(message("a1", "Weather?"), deps)).toEqual({ status: "answered" });
    expect(await handleIncomingMessage(message("a2", "And tomorrow?"), deps)).toEqual({ status: "answered" });
    expect(sent).toEqual(["*Answer* 1", "*Answer* 3"]);
    expect(reply.mock.calls[1][0].map((item) => item.role)).toEqual(["user", "assistant", "user"]);
    expect(reply.mock.calls[1][1]).toEqual(user);

    const chat = await loadChat(user.id, whatsAppChatId(user.id, from));
    expect(chat?.chat.title).toBe("Weather?");
    expect(chat?.messages.map((item) => item.role)).toEqual(["user", "assistant", "user", "assistant"]);
  });

  it("sends a sign-in link to billing when the plan is used up", async () => {
    const { sent, reply, deps, message } = setup({ consumeChat: async () => { throw new UsageLimitError("chat", "limit_exceeded", 15, 15); } });
    expect(await handleIncomingMessage(message("b0", "Weather?"), deps)).toEqual({ status: "limited" });
    expect(reply).not.toHaveBeenCalled();
    expect(sent[0]).toContain("https://hub.test/login?next=%2Fbilling");
  });

  it("meters one chat event per question, excluding duplicates and reset commands", async () => {
    const consumeChat = vi.fn(async () => undefined);
    const { deps, message, user } = setup({ consumeChat });
    await handleIncomingMessage(message("meter-1", "Weather?"), deps);
    await handleIncomingMessage(message("meter-1", "Weather?"), deps);
    await handleIncomingMessage(message("meter-reset", "/new"), deps);
    expect(consumeChat).toHaveBeenCalledExactlyOnceWith({ userId: user.id, messageId: "meter-1", channel: "whatsapp" });
  });

  it("fails closed and tells the user when chat billing is unavailable", async () => {
    const { deps, message, reply, sent } = setup({ consumeChat: async () => { throw new Error("offline"); } });
    expect(await handleIncomingMessage(message("offline", "Weather?"), deps)).toEqual({ status: "failed" });
    expect(reply).not.toHaveBeenCalled();
    expect(sent[0]).toContain("Chat billing is temporarily unavailable");
  });

  it("drops redelivered messages", async () => {
    const { sent, deps, message } = setup();
    await handleIncomingMessage(message("b1", "Hi"), deps);
    expect(await handleIncomingMessage(message("b1", "Hi"), deps)).toEqual({ status: "duplicate" });
    expect(sent).toHaveLength(1);
  });

  it("signs out on /signout and sends a new sign-in link", async () => {
    const { from, sent, reply, deps, message } = setup({ findUser: undefined });
    await linkNumber({ id: "erin", email: "erin@test" }, readLinkToken(createLinkToken(from))!);
    expect(await handleIncomingMessage(message("o1", "/SignOut"), deps)).toEqual({ status: "signed-out" });
    expect(await findLink(phoneHash(from))).toBeNull();
    expect(reply).not.toHaveBeenCalled();
    expect(sent[0]).toContain("Signed out");
    expect(sent[0]).toContain("https://hub.test/whatsapp/link?token=");
  });

  it("says so when /logout comes from a number that isn't linked", async () => {
    const { sent, deps, message } = setup({ signOut: async () => false });
    expect(await handleIncomingMessage(message("o2", "/logout"), deps)).toEqual({ status: "signed-out" });
    expect(sent[0]).toContain("isn't linked");
  });

  it("signs out when the agent's sign_out tool was called, after sending its reply", async () => {
    const signOut = vi.fn(async () => true);
    const { from, sent, deps, message } = setup({ reply: async () => ({ text: "", cards: [], signOut: true }), signOut });
    expect(await handleIncomingMessage(message("o3", "登出"), deps)).toEqual({ status: "signed-out" });
    expect(signOut).toHaveBeenCalledWith(from);
    // No "couldn't find an answer" when the agent only signed the user out.
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain("Signed out");
  });

  it("sends cards of the tool results before the answer, skipping any that fail", async () => {
    const card = (title: string): Card => ({ accent: "#000000", badge: "T", title, blocks: [] });
    const order: string[] = [];
    const { deps, message } = setup({
      reply: async () => ({ text: "Done", cards: [card("Broken"), card("Weather")] }),
      send: async (_to, text) => void order.push(`text:${text}`),
      sendCard: async (_to, value) => (value.title === "Broken" ? Promise.reject(new Error("render failed")) : void order.push(`card:${value.title}`)),
    });
    expect(await handleIncomingMessage(message("g1", "Weather?"), deps)).toEqual({ status: "answered" });
    expect(order).toEqual(["card:Weather", "text:Done"]);
  });

  it("starts over on /new", async () => {
    const { from, user, reply, deps, message } = setup();
    await handleIncomingMessage(message("c1", "Hi"), deps);
    expect(await handleIncomingMessage(message("c2", "/new"), deps)).toEqual({ status: "reset" });
    expect(await loadChat(user.id, whatsAppChatId(user.id, from))).toBeNull();
    await handleIncomingMessage(message("c3", "Hi again"), deps);
    expect(reply.mock.calls[1][0]).toHaveLength(1);
  });

  it("explains that only text is read", async () => {
    const { sent, reply, deps, message } = setup();
    expect(await handleIncomingMessage(message("d1", null), deps)).toEqual({ status: "unsupported" });
    expect(reply).not.toHaveBeenCalled();
    expect(sent[0]).toContain("only read text");
  });

  it("apologises when the agent fails", async () => {
    const { sent, deps, message } = setup({ reply: async () => Promise.reject(new Error("gateway down")) });
    expect(await handleIncomingMessage(message("f1", "Hi"), deps)).toEqual({ status: "failed" });
    expect(sent[0]).toContain("Sorry");
  });
});

describe("/api/whatsapp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("AUTH_SECRET", "test-secret");
  });
  const stubEnv = () => Object.entries(env).forEach(([key, value]) => vi.stubEnv(key, value));
  const post = (body: unknown, secret?: string) =>
    POST(new Request("http://localhost/api/whatsapp", { method: "POST", body: JSON.stringify(body), headers: secret ? { "x-webhook-signature": secret } : {} }));

  it("is not found until configured", async () => {
    expect((await post({})).status).toBe(404);
  });

  it("rejects webhooks without the secret and acknowledges ones with it", async () => {
    stubEnv();
    const status = { event: "session.status", data: { status: "connected" } };
    expect((await post(status)).status).toBe(401);
    expect((await post(status, "wrong")).status).toBe(401);
    expect((await post(status, "hook-secret")).status).toBe(200);
  });
});
