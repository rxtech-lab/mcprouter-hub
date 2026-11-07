import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, scheduledTasks, taskRuns } from "@/db";

/** Trusted internal callers still have to own the run they attribute consumption to. */
export async function recordTaskMcpUsage(input: { userId: string; runId?: string; premium: boolean; chargedUnits: number }) {
  if (!input.runId) return;
  await db.update(taskRuns).set({
    ...(input.premium ? { premiumMcpUnits: sql`${taskRuns.premiumMcpUnits} + 1` } : { mcpUnits: sql`${taskRuns.mcpUnits} + 1` }),
    mcpChargedUnits: sql`${taskRuns.mcpChargedUnits} + ${input.chargedUnits}`,
  }).where(and(eq(taskRuns.id, input.runId), inArray(taskRuns.taskId, db.select({ id: scheduledTasks.id }).from(scheduledTasks).where(eq(scheduledTasks.userId, input.userId)))));
}
