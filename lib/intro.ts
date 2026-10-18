import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { introReads } from "@/db/schema";
import { INTRO_CARDS, INTRO_CARD_IDS } from "@/lib/intro-cards";

/** Intro cards the user hasn't read yet, in the order they are shown. */
export async function unreadIntroCards(userId: string) {
  const rows = await db.select({ cardId: introReads.cardId }).from(introReads).where(eq(introReads.userId, userId));
  const read = new Set(rows.map((row) => row.cardId));
  return INTRO_CARDS.filter((card) => !read.has(card.id));
}

/** Marks cards as read. Unknown ids are ignored; reading a card twice is a no-op. */
export async function markIntroCardsRead(userId: string, cardIds: string[]) {
  const ids = [...new Set(cardIds)].filter((id) => INTRO_CARD_IDS.includes(id));
  if (!ids.length) return;
  await db
    .insert(introReads)
    .values(ids.map((cardId) => ({ userId, cardId })))
    .onConflictDoNothing();
}
