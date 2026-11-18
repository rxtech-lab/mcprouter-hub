"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TOOL_MODES } from "@/db/schema";
import { runAction } from "@/lib/action-result";
import { requireActionUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
import { serviceScopesSchema } from "@/lib/service-scopes";
import { unlinkAccount, updateLinkScopes, updateLinkToolMode } from "@/lib/telegram/link";

const unlinkSchema = (t: Translator) => z.object({ id: z.string().regex(/^[0-9a-f]{32}$/, t("Unknown account")) });

export async function unlinkTelegram(input: z.input<ReturnType<typeof unlinkSchema>>) {
  return runAction(async () => {
    const user = await requireActionUser();
    const { id } = unlinkSchema(await getT()).parse(input);
    await unlinkAccount(user.id, id);
    revalidatePath("/keys/telegram");
  });
}

/** Limits the services the bot may call for this link. */
export async function updateTelegramServices(input: { id: string; services: string[] }) {
  return runAction(async () => {
    const user = await requireActionUser();
    const t = await getT();
    const { id, services } = unlinkSchema(t).extend({ services: serviceScopesSchema(t) }).parse(input);
    await updateLinkScopes(user.id, id, services);
    revalidatePath("/keys/telegram");
  });
}

/** Sets how the bot's agent sees tools for this link: every tool by name, or the three search tools. */
export async function updateTelegramToolMode(input: { id: string; toolMode: string | null }) {
  return runAction(async () => {
    const user = await requireActionUser();
    const { id, toolMode } = unlinkSchema(await getT()).extend({ toolMode: z.enum(TOOL_MODES) }).parse(input);
    await updateLinkToolMode(user.id, id, toolMode);
    revalidatePath("/keys/telegram");
  });
}
