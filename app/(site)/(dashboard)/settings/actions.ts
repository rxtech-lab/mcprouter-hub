"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { mcpSettings } from "@/db/schema";
import { serviceById } from "@/generated/registry";
import { runAction } from "@/lib/action-result";
import { requireActionUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getExposure, type Exposure } from "@/lib/mcp/exposure";
import { REGIONS } from "@/lib/regions";
import { serviceScopesSchema } from "@/lib/service-scopes";

/** Writes one part of the user's exposure settings, keeping the rest. */
async function save(userId: string, patch: Partial<Exposure>) {
  const next = { ...(await getExposure(userId)), ...patch, updatedAt: new Date() };
  await db
    .insert(mcpSettings)
    .values({ userId, ...next })
    .onConflictDoUpdate({ target: mcpSettings.userId, set: next });
  revalidatePath("/settings");
}

export async function updateExposedRegions(input: { regions: string[] }) {
  return runAction(async () => {
    const user = await requireActionUser();
    const t = await getT();
    const { regions } = z
      .object({ regions: z.array(z.enum(REGIONS, t("Unknown region"))).max(REGIONS.length) })
      .parse(input);
    await save(user.id, { regions: [...new Set(regions)].sort() });
    return undefined;
  });
}

export async function updateExposedServices(input: { services: string[] }) {
  return runAction(async () => {
    const user = await requireActionUser();
    const t = await getT();
    const services = serviceScopesSchema(t).parse(input.services);
    await save(user.id, { services });
    return undefined;
  });
}

/** Sets which tools of one service are exposed; the others are hidden. */
export async function updateExposedTools(input: { service: string; tools: string[] }) {
  return runAction(async () => {
    const user = await requireActionUser();
    const t = await getT();
    const service = serviceById.get(z.string().min(1).parse(input.service));
    if (!service) throw new Error("NOT_FOUND");
    const names = service.tools.map((tool) => tool.name) as [string, ...string[]];
    const { tools } = z
      .object({ tools: z.array(z.enum(names, t("Unknown tool"))).min(1, t("Keep at least one tool, or hide the whole service instead")) })
      .parse(input);
    const { hiddenTools } = await getExposure(user.id);
    const hidden = [...hiddenTools.filter((name) => !names.includes(name)), ...names.filter((name) => !tools.includes(name))].sort();
    await save(user.id, { hiddenTools: hidden });
    return undefined;
  });
}

/** Back to the whole catalogue. */
export async function resetExposure() {
  return runAction(async () => {
    const user = await requireActionUser();
    await db.delete(mcpSettings).where(eq(mcpSettings.userId, user.id));
    revalidatePath("/settings");
    return undefined;
  });
}
