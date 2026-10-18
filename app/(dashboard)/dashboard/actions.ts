"use server";

import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { requireActionUser } from "@/lib/auth";
import { markIntroCardsRead } from "@/lib/intro";

const schema = z.object({ ids: z.array(z.string().max(60)).max(50) });

/** Called when the intro dialog closes, with the cards the user paged through. */
export async function markIntroRead(input: z.input<typeof schema>) {
  return runAction(async () => {
    const user = await requireActionUser();
    await markIntroCardsRead(user.id, schema.parse(input).ids);
    return undefined;
  });
}
