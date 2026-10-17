import type { UIMessage } from "ai";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { CHAT_PAGE_SIZE, deleteChat, ensureChat, listChats, loadChat, saveMessages } from "@/lib/chat-store";

const user = (id: string, text: string): UIMessage => ({ id, role: "user", parts: [{ type: "text", text }] });
const reply = (id: string, text: string): UIMessage => ({ id, role: "assistant", parts: [{ type: "text", text }] });

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
});

describe("chat store", () => {
  it("stores messages by id and loads them in order", async () => {
    const question = user("u1", "Weather   in\nHong Kong?");
    await ensureChat("alice", "chat-0001", question);
    await saveMessages("chat-0001", [question], 0);
    // The reply is saved with the full list; the question is upserted, not duplicated.
    await saveMessages("chat-0001", [question, reply("a1", "Partial")]);
    await saveMessages("chat-0001", [question, reply("a1", "24°C and sunny")]);

    const loaded = await loadChat("alice", "chat-0001");
    expect(loaded?.chat.title).toBe("Weather in Hong Kong?");
    expect(loaded?.messages).toEqual([question, reply("a1", "24°C and sunny")]);
  });

  it("hides chats from other users and refuses to reuse their ids", async () => {
    expect(await loadChat("bob", "chat-0001")).toBeNull();
    await expect(ensureChat("bob", "chat-0001", user("u2", "hi"))).rejects.toThrow("FORBIDDEN");
    await expect(deleteChat("bob", "chat-0001")).rejects.toThrow("NOT_FOUND");
  });

  it("pages newest first and filters by title", async () => {
    for (let index = 0; index < CHAT_PAGE_SIZE + 5; index++) {
      const id = `page-${String(index).padStart(4, "0")}`;
      await ensureChat("carol", id, user(`m-${id}`, index % 2 ? `Bus ${index}` : `Tram 100% ${index}`));
    }
    const first = await listChats("carol", {});
    expect(first.items).toHaveLength(CHAT_PAGE_SIZE);
    expect(first.nextCursor).not.toBeNull();
    const second = await listChats("carol", { cursor: first.nextCursor });
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(CHAT_PAGE_SIZE + 5);

    const trams = await listChats("carol", { query: "100%" });
    expect(trams.items.every((item) => item.title.startsWith("Tram"))).toBe(true);
    // `_` and `%` are literal, not wildcards: "m_1" must not match "Tram 100%".
    expect((await listChats("carol", { query: "m_1" })).items).toHaveLength(0);
  });

  it("deletes a chat with its messages", async () => {
    await deleteChat("alice", "chat-0001");
    expect(await loadChat("alice", "chat-0001")).toBeNull();
  });
});
