import "server-only";
import { and, eq } from "drizzle-orm";
import { db, scheduledTasks, taskRuns } from "@/db";

export type ChatRun = { status: "running" | "succeeded" | "failed"; error: string | null };

/** Owner-scoped run status; expired leases must not leave the chat waiting forever. */
export async function chatRun(userId: string, chatId: string): Promise<ChatRun | null> {
  const [run] = await db.select({ status: taskRuns.status, error: taskRuns.error, leaseId: scheduledTasks.leaseId, leaseUntil: scheduledTasks.leaseUntil, id: taskRuns.id })
    .from(taskRuns).innerJoin(scheduledTasks, eq(taskRuns.taskId, scheduledTasks.id))
    .where(and(eq(taskRuns.chatId, chatId), eq(scheduledTasks.userId, userId))).limit(1);
  if (!run) return null;
  if (run.status === "running" && (run.leaseId !== run.id || !run.leaseUntil || run.leaseUntil.getTime() <= Date.now())) {
    return { status: "failed", error: "Run interrupted or timed out; not retried automatically" };
  }
  return { status: run.status, error: run.error };
}
