import "server-only";
import { and, asc, eq, lte, or, isNull } from "drizzle-orm";
import { db, scheduledTasks, taskRuns } from "@/db";
import { ensureChat, saveMessages } from "@/lib/chat-store";
import { consumeChatMessage } from "@/lib/billing/chat";
import { generateAgentReply } from "@/lib/agent/run";
import { parseMcpServers, resolveServer } from "@/lib/agent/mcp-servers";
import { nextOccurrence } from "./definition";

/** One distributed compare-and-swap lease per task; no in-memory timers. */
export async function runDueTasks(origin: string) {
  const now = new Date();
  await db.update(taskRuns).set({ status: "failed", error: "Run interrupted or timed out; not retried automatically", finishedAt: now }).where(and(eq(taskRuns.status, "running"), lte(taskRuns.createdAt, new Date(now.getTime() - 600_000))));
  const available = () => and(eq(scheduledTasks.enabled, true), lte(scheduledTasks.nextRunAt, now), or(isNull(scheduledTasks.leaseUntil), lte(scheduledTasks.leaseUntil, now)));
  const due = await db.select().from(scheduledTasks).where(available()).orderBy(asc(scheduledTasks.nextRunAt)).limit(1);
  const outcomes = [];
  // Bounded concurrency, each invocation fits the deployment's function duration.
  for (const candidate of due) {
    const runId = crypto.randomUUID();
    const next = nextOccurrence(candidate.nextRunAt, candidate.intervalMinutes, now);
    const [task] = await db.update(scheduledTasks).set({ enabled: !!next, nextRunAt: next ?? candidate.nextRunAt, leaseId: runId, leaseUntil: new Date(now.getTime() + 600_000) }).where(and(eq(scheduledTasks.id, candidate.id), available())).returning();
    if (!task) continue;
    // A terminated invocation is visible as a failed run when its lease expires.
    await db.update(taskRuns).set({ status: "failed", error: "Run interrupted or timed out", finishedAt: now }).where(and(eq(taskRuns.taskId, task.id), eq(taskRuns.status, "running")));
    await db.insert(taskRuns).values({ id: runId, taskId: task.id, status: "running" });
    const chatId = `task-${runId}`;
    let status: "succeeded" | "failed" = "failed";
    try {
      const message = { id: `input-${runId}`, role: "user" as const, parts: [{ type: "text" as const, text: task.prompt }] };
      await ensureChat(task.userId, chatId, message);
      await saveMessages(chatId, [message]);
      await db.update(taskRuns).set({ chatId }).where(eq(taskRuns.id, runId));
      await consumeChatMessage({ userId: task.userId, messageId: message.id, channel: "web" });
      const servers = parseMcpServers(process.env.AGENT_MCP_SERVERS).map((server) => resolveServer(server, { origin, userId: task.userId, internalKey: process.env.MCPROUTER_INTERNAL_KEY, channel: "web", chatMetered: true }));
      const result = await generateAgentReply({
        userId: task.userId, servers, messages: [message], model: process.env.AI_MODEL ?? "anthropic/claude-sonnet-5-5",
        script: task.script, scheduled: true,
        channelNote: "This is an unattended scheduled task. Complete the instructions using available tools, then provide a standalone result. Do not ask questions, change schedules, or claim to send notifications. State missing access or data clearly.",
      });
      if (!result.text.trim()) throw new Error("Task returned no result");
      await saveMessages(chatId, [{ id: `answer-${runId}`, role: "assistant", parts: [{ type: "text", text: result.text }] }], 1);
      status = "succeeded";
    } catch {
      // Provider errors may contain OAuth secrets: never persist them.
      await db.update(taskRuns).set({ error: "Task failed. Check billing, MCP connections and script tool names before retrying." }).where(eq(taskRuns.id, runId));
    } finally {
      const finishedAt = new Date();
      await db.update(taskRuns).set({ status, finishedAt }).where(eq(taskRuns.id, runId));
      await db.update(scheduledTasks).set({ leaseId: null, leaseUntil: null }).where(and(eq(scheduledTasks.id, task.id), eq(scheduledTasks.leaseId, runId)));
    }
    outcomes.push({ id: task.id, status });
  }
  return outcomes;
}
