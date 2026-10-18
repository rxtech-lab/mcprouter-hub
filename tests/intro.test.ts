import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { markIntroCardsRead, unreadIntroCards } from "@/lib/intro";
import { INTRO_CARDS, INTRO_CARD_IDS } from "@/lib/intro-cards";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
});

describe("intro cards", () => {
  it("have unique ids, and tutorials come before features", () => {
    expect(new Set(INTRO_CARD_IDS).size).toBe(INTRO_CARDS.length);
    const kinds = INTRO_CARDS.map((card) => card.kind);
    expect(kinds.lastIndexOf("tutorial")).toBeLessThan(kinds.indexOf("feature"));
  });

  it("shows every card to a new user", async () => {
    expect((await unreadIntroCards("intro-new")).map((card) => card.id)).toEqual(INTRO_CARD_IDS);
  });

  it("hides cards once read, per user, and ignores repeats and unknown ids", async () => {
    await markIntroCardsRead("intro-alice", ["tutorial-tabs", "tutorial-tabs", "not-a-card"]);
    await markIntroCardsRead("intro-alice", ["tutorial-tabs", "feature-chat-agents"]);
    expect((await unreadIntroCards("intro-alice")).map((card) => card.id)).toEqual(
      INTRO_CARD_IDS.filter((id) => id !== "tutorial-tabs" && id !== "feature-chat-agents"),
    );
    expect(await unreadIntroCards("intro-bob")).toHaveLength(INTRO_CARDS.length);
  });

  it("shows nothing once everything is read", async () => {
    await markIntroCardsRead("intro-carol", INTRO_CARD_IDS);
    expect(await unreadIntroCards("intro-carol")).toEqual([]);
    await expect(markIntroCardsRead("intro-carol", [])).resolves.toBeUndefined();
  });
});
