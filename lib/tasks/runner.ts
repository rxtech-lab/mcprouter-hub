import "server-only";
import { and, asc, eq, lte, or, isNull, sql } from "drizzle-orm";
import { db, scheduledTasks, taskRuns } from "@/db";
import { ensureChat, saveMessages } from "@/lib/chat-store";
import { consumeChatMessage } from "@/lib/billing/chat";
import { generateAgentReply } from "@/lib/agent/run";
import { parseMcpServers, resolveServer } from "@/lib/agent/mcp-servers";
import { nextCronOccurrence } from "./definition";
import { taskFailure } from "./errors";
import { getTask } from "./store";

/** One distributed compare-and-swap lease per task; no in-memory timers. */
export async function runDueTasks(origin: string) {
  const now = new Date();
  const available = () => and(eq(scheduledTasks.enabled, true), lte(scheduledTasks.nextRunAt, now), or(isNull(scheduledTasks.leaseUntil), lte(scheduledTasks.leaseUntil, now)));
  const due = await db.select().from(scheduledTasks).where(available()).orderBy(asc(scheduledTasks.nextRunAt)).limit(1);
  const outcomes = [];
  // Bounded concurrency, each invocation fits the deployment's function duration.
  for (const candidate of due) {
    const runId = crypto.randomUUID();
    const next = candidate.cronExpression ? nextCronOccurrence(candidate.cronExpression, candidate.timeZone, now) : null;
    const [task] = await db.update(scheduledTasks).set({ enabled: !!next, nextRunAt: next ?? candidate.nextRunAt, leaseId: runId, leaseUntil: new Date(now.getTime() + 600_000) }).where(and(eq(scheduledTasks.id, candidate.id), available())).returning();
    if (!task) continue;
    const status = await executeTaskRun(task, runId, origin);
    outcomes.push({ id: task.id, status });
  }
  return outcomes;
}

/** Manual runs share the scheduler lease but never consume or move a scheduled occurrence. */
export async function claimManualTask(userId: string, id: string) {
  await getTask(userId, id);
  const now = new Date();
  const runId = crypto.randomUUID();
  const [task] = await db.update(scheduledTasks).set({ leaseId: runId, leaseUntil: new Date(now.getTime() + 600_000) })
    .where(and(eq(scheduledTasks.id, id), eq(scheduledTasks.userId, userId), or(isNull(scheduledTasks.leaseUntil), lte(scheduledTasks.leaseUntil, now)))).returning();
  if (!task) throw new Error("Task is already running. Wait for it to finish before trying again.");
  try {
    await db.update(taskRuns).set({ status: "failed", error: "Run interrupted or timed out", finishedAt: now }).where(and(eq(taskRuns.taskId, id), eq(taskRuns.status, "running")));
    await db.insert(taskRuns).values({ id: runId, taskId: id, status: "running", trigger: "manual", usageTracked: true });
  } catch (error) {
    await db.update(scheduledTasks).set({ leaseId: null, leaseUntil: null }).where(and(eq(scheduledTasks.id, id), eq(scheduledTasks.leaseId, runId)));
    throw error;
  }
  return { task, runId };
}

export async function executeTaskRun(task: typeof scheduledTasks.$inferSelect, runId: string, origin: string, prepared = false) {
  const now = new Date();
  // A terminated invocation is visible as a failed run when its lease expires.
  if (!prepared) await db.update(taskRuns).set({ status: "failed", error: "Run interrupted or timed out", finishedAt: now }).where(and(eq(taskRuns.taskId, task.id), eq(taskRuns.status, "running")));
  if (!prepared) await db.insert(taskRuns).values({ id: runId, taskId: task.id, status: "running", trigger: "scheduled", usageTracked: true });
  const chatId = `task-${runId}`;
  let status: "succeeded" | "failed" = "failed";
  let stage = "Preparing result chat";
  // The lease detects dead workers; renew it so healthy long runs never expire.
  let heartbeat: Promise<unknown> = Promise.resolve();
  const leaseTimer = setInterval(() => {
    heartbeat = heartbeat.then(() => db.update(scheduledTasks)
      .set({ leaseUntil: new Date(Date.now() + 600_000) })
      .where(and(eq(scheduledTasks.id, task.id), eq(scheduledTasks.leaseId, runId))))
      .catch(() => { console.error("[tasks] Could not renew task lease"); });
  }, 60_000);
  leaseTimer.unref();
  try {
    const message = { id: `input-${runId}`, role: "user" as const, parts: [{ type: "text" as const, text: task.prompt }] };
    await ensureChat(task.userId, chatId, message);
    await saveMessages(chatId, [message]);
    await db.update(taskRuns).set({ chatId }).where(eq(taskRuns.id, runId));
    stage = "Checking chat allowance";
    const consumption = await consumeChatMessage({ userId: task.userId, messageId: message.id, channel: "web" });
    await db.update(taskRuns).set({ chatUnits: consumption ? 1 : 0, chatChargedUnits: consumption?.chargedUnits ?? 0 }).where(eq(taskRuns.id, runId));
    stage = "Configuring MCP connections";
    const servers = parseMcpServers(process.env.AGENT_MCP_SERVERS).map((server) => resolveServer(server, { origin, userId: task.userId, internalKey: process.env.MCPROUTER_INTERNAL_KEY, channel: "web", chatMetered: true, taskRunId: runId }));
    let hasProgress = false;
    stage = "Running agent and MCP workflow";
    const result = await generateAgentReply({
      userId: task.userId, servers, messages: [message], model: process.env.AI_MODEL ?? "anthropic/claude-sonnet-5-5",
      script: task.script, scheduled: true,
      onProgress: async (reply) => {
        try {
          await saveMessages(chatId, [{ ...reply, id: `answer-${runId}` }], 1);
        } catch {
          throw new Error("Could not save the live task result. Check database availability.");
        }
        hasProgress = true;
      },
      onMcpCall: async () => { await db.update(taskRuns).set({ mcpCalls: sql`${taskRuns.mcpCalls} + 1` }).where(eq(taskRuns.id, runId)); },
      channelNote: "This is an unattended scheduled task. Complete the instructions using available tools, then provide a standalone result. Do not ask questions, change schedules, or claim to send notifications. State missing access or data clearly.",
    });
    if (!result.text.trim()) throw new Error("Task returned no result");
    stage = "Saving task result";
    if (!hasProgress) await saveMessages(chatId, [{ id: `answer-${runId}`, role: "assistant", parts: [{ type: "text", text: result.text }] }], 1);
    status = "succeeded";
  } catch (error) {
    await db.update(taskRuns).set({ error: taskFailure(stage, error) }).where(eq(taskRuns.id, runId));
  } finally {
    clearInterval(leaseTimer);
    await heartbeat;
    const finishedAt = new Date();
    await db.update(taskRuns).set({ status, finishedAt }).where(eq(taskRuns.id, runId));
    await db.update(scheduledTasks).set({ leaseId: null, leaseUntil: null }).where(and(eq(scheduledTasks.id, task.id), eq(scheduledTasks.leaseId, runId)));
  }
  return status;
}
