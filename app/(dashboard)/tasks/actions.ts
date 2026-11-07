"use server";

import { and, eq, isNull, lte, or } from "drizzle-orm";
import { after } from "next/server";
import { siteUrl } from "@/lib/site";
import { claimManualTask, executeTaskRun } from "@/lib/tasks/runner";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, scheduledTasks } from "@/db";
import { runAction } from "@/lib/action-result";
import { requireActionUser } from "@/lib/auth";
import { nextCronOccurrence } from "@/lib/tasks/definition";
import { getTask, saveTask } from "@/lib/tasks/store";

export async function saveScheduledTask(input: unknown, id?: string) {
  return runAction(async () => {
    const user = await requireActionUser();
    if (id) z.uuid().parse(id);
    const saved = await saveTask(user.id, input, id);
    revalidatePath("/tasks", "layout");
    return saved;
  });
}

export async function changeScheduledTask(id: string, operation: "enable" | "pause" | "delete") {
  return runAction(async () => {
    const user = await requireActionUser();
    z.uuid().parse(id);
    z.enum(["enable", "pause", "delete"]).parse(operation);
    const task = await getTask(user.id, id);
    if (task.leaseUntil && task.leaseUntil > new Date()) throw new Error("Task is running. Try again after it finishes.");
    const where = and(eq(scheduledTasks.id, id), eq(scheduledTasks.userId, user.id), or(isNull(scheduledTasks.leaseUntil), lte(scheduledTasks.leaseUntil, new Date())));
    const changed = operation === "delete"
      ? await db.delete(scheduledTasks).where(where).returning({ id: scheduledTasks.id })
      : await db.update(scheduledTasks).set({ enabled: operation === "enable", ...(operation === "enable" && task.nextRunAt <= new Date() ? { nextRunAt: task.cronExpression ? nextCronOccurrence(task.cronExpression, task.timeZone, new Date()) : new Date(Date.now() + 60_000) } : {}) }).where(where).returning({ id: scheduledTasks.id });
    if (!changed.length) throw new Error("Task changed or is running. Refresh and try again.");
    revalidatePath("/tasks", "layout");
  });
}

export async function runScheduledTask(id: string) {
  return runAction(async () => {
    const user = await requireActionUser();
    z.uuid().parse(id);
    const origin = new URL(process.env.APP_URL ?? await siteUrl()).origin;
    const { task, runId } = await claimManualTask(user.id, id);
    after(async () => { await executeTaskRun(task, runId, origin, true); });
    revalidatePath("/tasks", "layout");
    return runId;
  });
}
