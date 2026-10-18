"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { requireActionUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
import { unlinkNumber } from "@/lib/whatsapp/link";

const unlinkSchema = (t: Translator) => z.object({ id: z.string().regex(/^[0-9a-f]{32}$/, t("Unknown number")) });

export async function unlinkWhatsApp(input: z.input<ReturnType<typeof unlinkSchema>>) {
  return runAction(async () => {
    const user = await requireActionUser();
    const { id } = unlinkSchema(await getT()).parse(input);
    await unlinkNumber(user.id, id);
    revalidatePath("/keys/whatsapp");
  });
}
