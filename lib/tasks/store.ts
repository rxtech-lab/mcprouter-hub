import "server-only";
import { and, desc, eq, isNull, lte, or } from "drizzle-orm";
import { db, scheduledTasks, taskRuns } from "@/db";
import { nextCronOccurrence, taskSchema } from "./definition";

export async function listTasks(userId: string) {
  return db.select().from(scheduledTasks).where(eq(scheduledTasks.userId, userId)).orderBy(desc(scheduledTasks.createdAt)).limit(100);
}
export async function getTask(userId: string, id: string) {
  const [task] = await db.select().from(scheduledTasks).where(and(eq(scheduledTasks.id, id), eq(scheduledTasks.userId, userId)));
  if (!task) throw new Error("NOT_FOUND");
  return task;
}
export async function runsFor(userId: string, id: string) {
  await getTask(userId, id);
  return db.select().from(taskRuns).where(eq(taskRuns.taskId, id)).orderBy(desc(taskRuns.createdAt)).limit(30);
}
export async function saveTask(userId: string, input: unknown, id?: string, enabled = true) {
  const data = taskSchema.parse(input);
  const now = new Date();
  const nextRunAt = data.cronExpression ? nextCronOccurrence(data.cronExpression, data.timeZone, now) : new Date(data.runAt!);
  if (nextRunAt <= now) throw new Error("Choose a future run time");
  const values = { title: data.title, prompt: data.prompt, script: data.script, intervalMinutes: null, cronExpression: data.cronExpression, timeZone: data.timeZone, nextRunAt };
  if (id) {
    await getTask(userId, id);
    const result = await db.update(scheduledTasks).set(values).where(and(eq(scheduledTasks.id, id), eq(scheduledTasks.userId, userId), or(isNull(scheduledTasks.leaseUntil), lte(scheduledTasks.leaseUntil, new Date())))).returning();
    if (!result.length) throw new Error("NOT_FOUND");
    return id;
  }
  id = crypto.randomUUID();
  await db.insert(scheduledTasks).values({ id, userId, enabled, ...values });
  return id;
}
