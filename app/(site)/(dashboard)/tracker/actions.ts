"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { DATASET_STATUSES, datasets, datasetStatus } from "@/db/schema";
import { runAction } from "@/lib/action-result";
import { isAdmin, requireActionUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";

// Built per request so the validation message comes back in the user's language.
const schema = (t: Translator) =>
  z
    .object({
      datasetId: z.string().min(1),
      status: z.enum(DATASET_STATUSES).nullable(),
      reason: z.string().trim().max(500).optional().transform((value) => value || null),
      priority: z.number().int().min(0).max(3),
    })
    .refine((value) => value.status !== "skipped" || value.reason, { message: t("Say why this dataset is skipped"), path: ["reason"] });

export async function setDatasetStatus(input: z.input<ReturnType<typeof schema>>) {
  return runAction(async () => {
    const user = await requireActionUser();
    if (!isAdmin(user)) throw new Error("FORBIDDEN");
    const data = schema(await getT()).parse(input);
    const [dataset] = await db.select({ id: datasets.id }).from(datasets).where(eq(datasets.id, data.datasetId)).limit(1);
    if (!dataset) throw new Error("NOT_FOUND");
    if (data.status === null) {
      await db.delete(datasetStatus).where(eq(datasetStatus.datasetId, data.datasetId));
    } else {
      const values = { status: data.status, reason: data.reason, priority: data.priority, updatedBy: user.id, updatedAt: new Date() };
      await db.insert(datasetStatus).values({ datasetId: data.datasetId, ...values }).onConflictDoUpdate({ target: datasetStatus.datasetId, set: values });
    }
    revalidatePath("/tracker", "layout");
    return undefined;
  });
}
