import { createHmac } from "node:crypto";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { UsageLimitError } from "@/lib/billing/errors";
import { db } from "@/db";
import { POST } from "@/app/api/telegram/route";
import { loadChat } from "@/lib/chat-store";
import { commandOf, parseUpdate, sendPhoto, sendText, splitMessage, telegramConfig, toTelegramHtml, verifySecretToken, type IncomingMessage } from "@/lib/telegram/api";
import { handleIncomingMessage, linkedMessage, telegramChatId, type BotDeps } from "@/lib/telegram/bot";
import { createLinkToken, findLink, LINK_TOKEN_TTL_MS, linkAccount, listLinks, readLinkToken, signOutAccount, telegramHash, unlinkAccount, updateLinkScopes } from "@/lib/telegram/link";
import type { Card } from "@/mcp/apps/card";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "hub.test" }) }));

beforeAll(async () => {
  vi.stubEnv("AUTH_SECRET", "test-secret");
  await migrate(db, { migrationsFolder: "db/migrations" });
});

const env = { TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_WEBHOOK_SECRET: "hook-secret" };

const update = (message: object, extra: object = {}) => ({
  update_id: 1,
  message: { message_id: 7, from: { id: 42, is_bot: false, first_name: "Ada", username: "ada" }, chat: { id: 42, type: "private" }, date: 1, ...message },
  ...extra,
});

describe("telegramConfig", () => {
  it("is off until the bot token and webhook secret are both set", () => {
    expect(telegramConfig({}).enabled).toBe(false);
    expect(telegramConfig({ TELEGRAM_BOT_TOKEN: "123:abc" }).enabled).toBe(false);
    expect(telegramConfig({ ...env, AI_MODEL: "openai/gpt-5" })).toMatchObject({ enabled: true, model: "openai/gpt-5", botUsername: null });
    expect(telegramConfig({ ...env, TELEGRAM_MODEL: "x/y", TELEGRAM_BOT_USERNAME: "@hub_bot" })).toMatchObject({ model: "x/y", botUsername: "hub_bot" });
  });
});

describe("verifySecretToken", () => {
  it("accepts only the exact webhook secret", () => {
    expect(verifySecretToken("hook-secret", "hook-secret")).toBe(true);
    expect(verifySecretToken("hook-secreT", "hook-secret")).toBe(false);
    expect(verifySecretToken(null, "hook-secret")).toBe(false);
  });
});

describe("parseUpdate", () => {
  it("reads private text messages and marks other types unreadable", () => {
    expect(parseUpdate(update({ text: "Weather?" }))).toEqual({ id: "tg_42_7", chatId: 42, from: "42", name: "@ada", text: "Weather?" });
    expect(parseUpdate(update({ photo: [{}], from: { id: 42, first_name: "Ada" } }))).toMatchObject({ name: "Ada", text: null });
  });

  it("ignores groups, bots, edits and junk", () => {
    expect(parseUpdate(update({ text: "Hi", chat: { id: -100, type: "group" } }))).toBeNull();
    expect(parseUpdate(update({ text: "Hi", from: { id: 9, is_bot: true } }))).toBeNull();
    expect(parseUpdate({ update_id: 2, edited_message: { message_id: 1, text: "Hi" } })).toBeNull();
    expect(parseUpdate(null)).toBeNull();
  });
});

describe("commandOf", () => {
  it("reads commands with a bot suffix or payload", () => {
    expect(commandOf("/new")).toBe("/new");
    expect(commandOf("/NEW@hub_bot")).toBe("/new");
    expect(commandOf("/start abc")).toBe("/start");
    expect(commandOf("what about /new")).toBeNull();
  });
});

describe("toTelegramHtml", () => {
  it("converts markdown to Telegram HTML and escapes the rest", () => {
    const markdown = ["## Weather", "It's **24°C** and *sunny*, ~~no rain~~ <maybe> & more.", "- Humidity 70%", "More at [HKO](https://www.hko.gov.hk/?a=1&b=2).", "|---|---|"].join("\n");
    expect(toTelegramHtml(markdown)).toBe(
      ["<b>Weather</b>", "It's <b>24°C</b> and <i>sunny</i>, <s>no rain</s> &lt;maybe&gt; &amp; more.", "• Humidity 70%", 'More at <a href="https://www.hko.gov.hk/?a=1&amp;b=2">HKO</a>.'].join("\n"),
    );
  });

  it("leaves arithmetic and code alone", () => {
    expect(toTelegramHtml("2 * 3 * 4 = 24")).toBe("2 * 3 * 4 = 24");
    expect(toTelegramHtml("Run `kmb_eta **x**`")).toBe("Run <code>kmb_eta **x**</code>");
    expect(toTelegramHtml("```ts\na < b\n```")).toBe("<pre>a &lt; b</pre>");
  });
});

describe("splitMessage", () => {
  it("splits long replies on paragraph breaks", () => {
    expect(splitMessage(`${"a".repeat(70)}\n\n${"b".repeat(50)}`, 100)).toEqual(["a".repeat(70), "b".repeat(50)]);
  });
});

describe("sendText", () => {
  it("sends each chunk as HTML with the button on the last one", async () => {
    const fetcher = vi.fn(async () => Response.json({ ok: true, result: {} }));
    await sendText(telegramConfig(env), 42, `**${"a".repeat(3400)}**\n\n${"b".repeat(200)}`, { text: "Go", url: "https://hub.test" }, fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
    expect(JSON.parse(init.body as string)).toMatchObject({ chat_id: 42, parse_mode: "HTML", text: `<b>${"a".repeat(3400)}</b>` });
    expect(JSON.parse(init.body as string).reply_markup).toBeUndefined();
    const last = JSON.parse((fetcher.mock.calls[1] as unknown as [string, RequestInit])[1].body as string);
    expect(last.reply_markup).toEqual({ inline_keyboard: [[{ text: "Go", url: "https://hub.test" }]] });
  });

  it("falls back to plain text when Telegram can't parse the HTML", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ ok: false, description: "can't parse entities" }, { status: 400 }))
      .mockResolvedValueOnce(Response.json({ ok: true, result: {} }));
    await sendText(telegramConfig(env), 42, "**hi**", undefined, fetcher as unknown as typeof fetch);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ chat_id: 42, link_preview_options: { is_disabled: true }, text: "**hi**" });
  });

  it("retries once on flood control, then throws with the API's error", async () => {
    const limited = () => Response.json({ ok: false, parameters: { retry_after: 0.001 } }, { status: 429 });
    const ok = vi.fn().mockResolvedValueOnce(limited()).mockResolvedValueOnce(Response.json({ ok: true, result: {} }));
    await sendText(telegramConfig(env), 1, "hi", undefined, ok as unknown as typeof fetch);
    expect(ok).toHaveBeenCalledTimes(2);
    const failing = vi.fn(async () => Response.json({ ok: false, description: "Unauthorized" }, { status: 401 }));
    await expect(sendText(telegramConfig(env), 1, "hi", undefined, failing as unknown as typeof fetch)).rejects.toThrow("Telegram 401");
  });
});

describe("sendPhoto", () => {
  it("uploads the PNG as multipart form data", async () => {
    const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({ ok: true, result: {} }));
    await sendPhoto(telegramConfig(env), 42, new Uint8Array([137, 80, 78, 71]), fetcher as unknown as typeof fetch);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bot123:abc/sendPhoto");
    const form = init!.body as FormData;
    expect(form.get("chat_id")).toBe("42");
    expect((form.get("photo") as File).type).toBe("image/png");
  });
});

describe("link tokens", () => {
  it("round-trips the account's hash, name and chat until it expires", () => {
    const now = Date.now();
    const token = createLinkToken("42", "@ada", 42, now);
    expect(readLinkToken(token, now)).toEqual({ telegramHash: telegramHash("42"), displayName: "@ada", chatId: 42, expiresAt: now + LINK_TOKEN_TTL_MS });
    expect(readLinkToken(token, now + LINK_TOKEN_TTL_MS + 1)).toBeNull();
  });

  it("rejects tampered and malformed tokens", () => {
    const [payload, signature] = createLinkToken("42", "@ada", 42).split(".");
    const forged = Buffer.from(JSON.stringify({ h: telegramHash("43"), n: "@eve", e: Date.now() + 60_000 })).toString("base64url");
    expect(readLinkToken(`${forged}.${signature}`)).toBeNull();
    expect(readLinkToken(`${payload}.x`)).toBeNull();
    expect(readLinkToken(null)).toBeNull();
  });

  it("keeps the chat id out of the readable payload", () => {
    const [payload] = createLinkToken("123456789", "@ada", 123456789).split(".");
    expect(Buffer.from(payload, "base64url").toString()).not.toContain("123456789");
  });

  it("still reads tokens minted before they carried the chat", () => {
    const payload = Buffer.from(JSON.stringify({ h: telegramHash("42"), n: "@ada", e: Date.now() + 60_000 })).toString("base64url");
    const signature = createHmac("sha256", "test-secret").update(`telegram-link:${payload}`).digest("base64url");
    expect(readLinkToken(`${payload}.${signature}`)).toMatchObject({ telegramHash: telegramHash("42"), chatId: null });
  });
});

describe("linked accounts", () => {
  it("links an account to one user at a time and unlinks only for its owner", async () => {
    const claims = readLinkToken(createLinkToken("777", "@grace", 777))!;
    await linkAccount({ id: "alice", email: "alice@test" }, claims);
    expect(await findLink(claims.telegramHash)).toMatchObject({ userId: "alice", displayName: "@grace" });

    await linkAccount({ id: "bob", email: "bob@test" }, claims);
    expect((await findLink(claims.telegramHash))?.userId).toBe("bob");
    expect(await listLinks("alice")).toEqual([]);

    await expect(unlinkAccount("alice", claims.telegramHash)).rejects.toThrow("NOT_FOUND");
    await unlinkAccount("bob", claims.telegramHash);
    expect(await findLink(claims.telegramHash)).toBeNull();
  });

  it("signs out from whichever account the Telegram account is linked to", async () => {
    const claims = readLinkToken(createLinkToken("778", "@grace", 778))!;
    await linkAccount({ id: "carol", email: "carol@test" }, claims);
    expect(await signOutAccount(claims.telegramHash)).toBe(true);
    expect(await findLink(claims.telegramHash)).toBeNull();
    expect(await signOutAccount(claims.telegramHash)).toBe(false);
  });
});

describe("linkedMessage", () => {
  it("confirms the account and mentions /signout", () => {
    expect(linkedMessage("ada@test")).toContain("**ada@test**");
    expect(linkedMessage("ada@test")).toContain("/signout");
    expect(linkedMessage("")).toMatch(/^You're signed in\. /);
  });
});

describe("handleIncomingMessage", () => {
  let counter = 0;
  function setup(overrides: Partial<BotDeps> = {}) {
    const from = String(1000 + ++counter);
    const user = { id: `tg-user-${counter}`, email: `user${counter}@test` };
    const sent: { text: string; button?: { text: string; url: string } }[] = [];
    const reply = vi.fn<NonNullable<BotDeps["reply"]>>(async (messages) => ({ text: `**Answer** ${messages.length}`, cards: [] }));
    const deps: BotDeps = {
      config: telegramConfig(env),
      origin: "https://hub.test",
      findUser: async () => user,
      consumeChat: async () => undefined,
      reply,
      send: async (_chatId, text, button) => void sent.push({ text, button }),
      typing: async () => {},
      ...overrides,
    };
    const message = (id: string, text: string | null): IncomingMessage => ({ id, chatId: Number(from), from, name: "@ada", text });
    return { from, user, sent, reply, deps, message };
  }

  it("sends a sign-in button to accounts that aren't linked", async () => {
    const { from, sent, reply, deps, message } = setup({ findUser: async () => null });
    expect(await handleIncomingMessage(message("a0", "/start"), deps)).toEqual({ status: "sign-in" });
    expect(reply).not.toHaveBeenCalled();
    expect(sent[0].text).toContain("https://hub.test/telegram/link?token=");
    const token = new URL(sent[0].button!.url).searchParams.get("token");
    expect(readLinkToken(token)).toMatchObject({ telegramHash: telegramHash(from), displayName: "@ada", chatId: Number(from) });
  });

  it("puts no button on http links, which Telegram refuses", async () => {
    const { sent, deps, message } = setup({ findUser: async () => null, origin: "http://localhost:3000" });
    await handleIncomingMessage(message("a00", "Hi"), deps);
    expect(sent[0].button).toBeUndefined();
  });

  it("answers as the linked user and saves the chat in their history", async () => {
    const { from, user, sent, reply, deps, message } = setup();
    expect(await handleIncomingMessage(message("a1", "Weather?"), deps)).toEqual({ status: "answered" });
    expect(await handleIncomingMessage(message("a2", "And tomorrow?"), deps)).toEqual({ status: "answered" });
    expect(sent.map((item) => item.text)).toEqual(["**Answer** 1", "**Answer** 3"]);
    expect(reply.mock.calls[1][1]).toEqual(user);

    const chat = await loadChat(user.id, telegramChatId(user.id, from));
    expect(chat?.chat.title).toBe("Weather?");
    expect(chat?.messages.map((item) => item.role)).toEqual(["user", "assistant", "user", "assistant"]);
  });

  it("greets linked users on /start without calling the agent", async () => {
    const { sent, reply, deps, message } = setup();
    expect(await handleIncomingMessage(message("s1", "/start"), deps)).toEqual({ status: "welcome" });
    expect(reply).not.toHaveBeenCalled();
    expect(sent[0].text).toContain("linked");
  });

  it("sends a billing link when the plan is used up", async () => {
    const { sent, reply, deps, message } = setup({ consumeChat: async () => { throw new UsageLimitError("chat", "limit_exceeded", 15, 15); } });
    expect(await handleIncomingMessage(message("b0", "Weather?"), deps)).toEqual({ status: "limited" });
    expect(reply).not.toHaveBeenCalled();
    expect(sent[0].button?.url).toBe("https://hub.test/login?next=%2Fbilling");
  });

  it("meters one chat event per question, excluding duplicates and reset commands", async () => {
    const consumeChat = vi.fn(async () => undefined);
    const { deps, message, user } = setup({ consumeChat });
    await handleIncomingMessage(message("meter-1", "Weather?"), deps);
    await handleIncomingMessage(message("meter-1", "Weather?"), deps);
    await handleIncomingMessage(message("meter-reset", "/new"), deps);
    expect(consumeChat).toHaveBeenCalledExactlyOnceWith({ userId: user.id, messageId: "meter-1", channel: "telegram" });
  });

  it("fails closed and tells the user when chat billing is unavailable", async () => {
    const { deps, message, reply, sent } = setup({ consumeChat: async () => { throw new Error("offline"); } });
    expect(await handleIncomingMessage(message("offline", "Weather?"), deps)).toEqual({ status: "failed" });
    expect(reply).not.toHaveBeenCalled();
    expect(sent[0].text).toContain("Chat billing is temporarily unavailable");
  });

  it("drops redelivered messages", async () => {
    const { sent, deps, message } = setup();
    await handleIncomingMessage(message("b1", "Hi"), deps);
    expect(await handleIncomingMessage(message("b1", "Hi"), deps)).toEqual({ status: "duplicate" });
    expect(sent).toHaveLength(1);
  });

  it("starts over on /new", async () => {
    const { from, user, reply, deps, message } = setup();
    await handleIncomingMessage(message("c1", "Hi"), deps);
    expect(await handleIncomingMessage(message("c2", "/new@hub_bot"), deps)).toEqual({ status: "reset" });
    expect(await loadChat(user.id, telegramChatId(user.id, from))).toBeNull();
    await handleIncomingMessage(message("c3", "Hi again"), deps);
    expect(reply.mock.calls[1][0]).toHaveLength(1);
  });

  it("explains that only text is read", async () => {
    const { sent, reply, deps, message } = setup();
    expect(await handleIncomingMessage(message("d1", null), deps)).toEqual({ status: "unsupported" });
    expect(reply).not.toHaveBeenCalled();
    expect(sent[0].text).toContain("only read text");
  });

  it("signs out on /signout and offers a new sign-in link", async () => {
    const { from, sent, reply, deps, message } = setup({ findUser: undefined });
    const claims = readLinkToken(createLinkToken(from, "@ada", Number(from)))!;
    await linkAccount({ id: "dave", email: "dave@test" }, claims);
    expect(await handleIncomingMessage(message("o1", "/signout"), deps)).toEqual({ status: "signed-out" });
    expect(await findLink(telegramHash(from))).toBeNull();
    expect(reply).not.toHaveBeenCalled();
    expect(sent[0].text).toContain("Signed out");
    expect(sent[0].button?.url).toContain("https://hub.test/telegram/link?token=");
  });

  it("says so when /logout is sent by an account that isn't linked", async () => {
    const { sent, deps, message } = setup({ signOut: async () => false });
    expect(await handleIncomingMessage(message("o2", "/logout@hub_bot"), deps)).toEqual({ status: "signed-out" });
    expect(sent[0].text).toContain("isn't linked");
  });

  it("signs out when the agent's sign_out tool was called, after sending its reply", async () => {
    const order: string[] = [];
    const signOut = vi.fn(async () => true);
    const { from, user, deps, message } = setup({
      reply: async () => ({ text: "Bye!", cards: [], signOut: true }),
      send: async (_chatId, text) => void order.push(text),
      signOut,
    });
    expect(await handleIncomingMessage(message("o3", "please log me out"), deps)).toEqual({ status: "signed-out" });
    expect(signOut).toHaveBeenCalledWith(from);
    expect(order[0]).toBe("Bye!");
    expect(order[1]).toContain("Signed out");
    expect((await loadChat(user.id, telegramChatId(user.id, from)))?.messages.map((item) => item.role)).toEqual(["user", "assistant"]);
  });

  it("sends cards of the tool results before the answer, skipping any that fail", async () => {
    const card = (title: string): Card => ({ accent: "#000000", badge: "T", title, blocks: [] });
    const order: string[] = [];
    const { deps, message } = setup({
      reply: async () => ({ text: "Done", cards: [card("Broken"), card("Weather")] }),
      send: async (_chatId, text) => void order.push(`text:${text}`),
      sendCard: async (_chatId, value) => (value.title === "Broken" ? Promise.reject(new Error("render failed")) : void order.push(`card:${value.title}`)),
    });
    expect(await handleIncomingMessage(message("g1", "Weather?"), deps)).toEqual({ status: "answered" });
    expect(order).toEqual(["card:Weather", "text:Done"]);
  });

  it("apologises when the agent fails", async () => {
    const { sent, deps, message } = setup({ reply: async () => Promise.reject(new Error("gateway down")) });
    expect(await handleIncomingMessage(message("f1", "Hi"), deps)).toEqual({ status: "failed" });
    expect(sent[0].text).toContain("Sorry");
  });
});

describe("/api/telegram", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("AUTH_SECRET", "test-secret");
  });
  const stubEnv = () => Object.entries(env).forEach(([key, value]) => vi.stubEnv(key, value));
  const post = (body: unknown, secret?: string) =>
    POST(new Request("http://localhost/api/telegram", { method: "POST", body: JSON.stringify(body), headers: secret ? { "x-telegram-bot-api-secret-token": secret } : {} }));

  it("is not found until configured", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    expect((await post({})).status).toBe(404);
  });

  it("rejects webhooks without the secret and acknowledges ones with it", async () => {
    stubEnv();
    const edit = { update_id: 3, edited_message: { message_id: 1 } };
    expect((await post(edit)).status).toBe(401);
    expect((await post(edit, "wrong")).status).toBe(401);
    expect((await post(edit, "hook-secret")).status).toBe(200);
  });
});

describe("link service limits", () => {
  it("keeps them when the same account links again, and clears them for another account", async () => {
    const claims = { telegramHash: telegramHash("scopes-1"), displayName: "@scopes", chatId: 1, expiresAt: Date.now() + 60_000 };
    await linkAccount({ id: "scopes-alice", email: "" }, claims);
    await updateLinkScopes("scopes-alice", claims.telegramHash, ["hk-bus"]);
    await linkAccount({ id: "scopes-alice", email: "" }, claims);
    expect((await findLink(claims.telegramHash))?.scopes).toEqual(["hk-bus"]);
    await linkAccount({ id: "scopes-bob", email: "" }, claims);
    expect(await findLink(claims.telegramHash)).toMatchObject({ userId: "scopes-bob", scopes: [] });
    await expect(updateLinkScopes("scopes-alice", claims.telegramHash, [])).rejects.toThrow("NOT_FOUND");
  });
});
