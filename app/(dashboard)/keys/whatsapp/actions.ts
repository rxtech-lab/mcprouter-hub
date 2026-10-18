"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { requireActionUser } from "@/lib/auth";
import { unlinkNumber } from "@/lib/whatsapp/link";

const unlinkSchema = z.object({ id: z.string().regex(/^[0-9a-f]{32}$/, "Unknown number") });

export async function unlinkWhatsApp(input: z.input<typeof unlinkSchema>) {
  return runAction(async () => {
    const user = await requireActionUser();
    const { id } = unlinkSchema.parse(input);
    await unlinkNumber(user.id, id);
    revalidatePath("/keys/whatsapp");
  });
}
