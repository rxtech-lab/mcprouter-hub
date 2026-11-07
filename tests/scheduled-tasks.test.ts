import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { db, scheduledTasks, taskRuns } from "@/db";
import { getTask, listTasks, saveTask } from "@/lib/tasks/store";
import { nextCronOccurrence, taskSchema } from "@/lib/tasks/definition";
import { loadChat } from "@/lib/chat-store";

vi.mock("@/lib/agent/run", () => ({ generateAgentReply: vi.fn(async () => ({ text: "Weather report", visuals: [] })) }));
vi.mock("@/lib/billing/chat", () => ({ consumeChatMessage: vi.fn() }));
import { generateAgentReply } from "@/lib/agent/run";
import { consumeChatMessage } from "@/lib/billing/chat";
import { claimManualTask, executeTaskRun, runDueTasks } from "@/lib/tasks/runner";
import { recordTaskMcpUsage } from "@/lib/tasks/usage";
import { chatRun } from "@/lib/tasks/chat-run";
import { taskTools } from "@/lib/tasks/agent-tools";

const definition = () => ({ title: "Weather", prompt: "Report weather", runAt: new Date(Date.now() + 3600_000).toISOString(), cronExpression: "0 * * * *", timeZone: "UTC", script: "[]" });
beforeAll(async () => { await migrate(db, { migrationsFolder: "db/migrations" }); process.env.MCPROUTER_INTERNAL_KEY = "test-only-key"; });
beforeEach(async () => { await db.delete(taskRuns); await db.delete(scheduledTasks); vi.clearAllMocks(); });

async function due(userId = "alice", cronExpression: string | null = "0 * * * *") {
  const id = await saveTask(userId, { ...definition(), cronExpression });
  await db.update(scheduledTasks).set({ nextRunAt: new Date(Date.now() - 1000) }).where(eq(scheduledTasks.id, id));
  return id;
}

describe("scheduled task validation and isolation", () => {
  it("rejects arbitrary code, excessive steps, invalid cron expressions and timestamps", () => {
    for (const script of ["fetch('https://evil.test')", JSON.stringify(Array(21).fill({ tool: "weather", arguments: {} })), '[{"tool":"../shell"}]']) expect(taskSchema.safeParse({ ...definition(), script }).success).toBe(false);
    expect(taskSchema.safeParse({ ...definition(), runAt: "tomorrow" }).success).toBe(false);
    expect(taskSchema.safeParse({ ...definition(), cronExpression: "60 * * * *" }).success).toBe(false);
    expect(taskSchema.safeParse({ ...definition(), script: '[{"tool":"oauth_abc__read","arguments":{"count":3}}]' }).success).toBe(true);
  });

  it("validates cron fields, calendar dates, time zones and one-time requirements", () => {
    for (const cronExpression of ["", "* * * *", "* * * * * *", "60 * * * *", "0 24 * * *", "*/0 * * * *", "0 0 30 2 *"]) {
      expect(taskSchema.safeParse({ ...definition(), cronExpression }).success, cronExpression).toBe(false);
    }
    expect(taskSchema.safeParse({ ...definition(), timeZone: "Invalid/Zone" }).success).toBe(false);
    expect(taskSchema.safeParse({ title: "Once", prompt: "Report", cronExpression: null }).success).toBe(false);
    expect(taskSchema.safeParse({ ...definition(), cronExpression: null }).success).toBe(true);
  });
  it("calculates steps, lists, weekdays and calendar boundaries in the selected time zone", () => {
    expect(nextCronOccurrence("*/15 9-17 * * 1-5", "Asia/Shanghai", new Date("2026-11-06T09:59:00Z")).toISOString()).toBe("2026-11-09T01:00:00.000Z");
    expect(nextCronOccurrence("0 9,17 * * *", "UTC", new Date("2026-11-06T09:00:00Z")).toISOString()).toBe("2026-11-06T17:00:00.000Z");
    expect(nextCronOccurrence("0 0 1 * *", "UTC", new Date("2026-12-31T23:59:59Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
  it("keeps daily wall time across daylight saving changes", () => {
    expect(nextCronOccurrence("0 9 * * *", "America/New_York", new Date("2026-10-31T13:00:00Z")).toISOString()).toBe("2026-11-01T14:00:00.000Z");
    expect(nextCronOccurrence("0 9 * * *", "America/New_York", new Date("2026-03-07T14:00:00Z")).toISOString()).toBe("2026-03-08T13:00:00.000Z");
  });
  it("migrates fixed repeats to UTC cron without changing queued times or one-time tasks", async () => {
    const client = createClient({ url: ":memory:" });
    try {
      await client.execute("CREATE TABLE scheduled_tasks (id TEXT, interval_minutes INTEGER, next_run_at INTEGER)");
      const next = new Date("2026-11-06T09:30:00Z").getTime();
      for (const interval of [60, 1440, 10080, null]) await client.execute({ sql: "INSERT INTO scheduled_tasks VALUES (?, ?, ?)", args: [String(interval), interval, next] });
      for (const sql of readFileSync("db/migrations/0015_task_cron.sql", "utf8").split("--> statement-breakpoint")) await client.execute(sql);
      const { rows } = await client.execute("SELECT * FROM scheduled_tasks");
      expect(rows.map((row) => row.cron_expression)).toEqual(["30 * * * *", "30 09 * * *", "30 09 * * 5", null]);
      expect(rows.every((row) => row.time_zone === "UTC" && row.interval_minutes === null && row.next_run_at === next)).toBe(true);
    } finally { client.close(); }
  });
  it("only lists and edits the owner's tasks", async () => {
    const id = await saveTask("alice", definition());
    expect(await listTasks("bob")).toEqual([]);
    await expect(getTask("bob", id)).rejects.toThrow("NOT_FOUND");
    await expect(saveTask("bob", definition(), id)).rejects.toThrow("NOT_FOUND");
    expect((await getTask("alice", id)).title).toBe("Weather");
  });
  it("creates chat-agent drafts paused, with a review link", async () => {
    const tool = taskTools("alice").draft_scheduled_task;
    const { runAt, ...cronDraft } = definition();
    void runAt;
    const result = await tool.execute!(cronDraft, { toolCallId: "draft", messages: [], context: {} });
    expect(result).toMatchObject({ enabled: false, label: "Review scheduled task" });
    expect((await listTasks("alice"))[0]).toMatchObject({ enabled: false, cronExpression: "0 * * * *", timeZone: "UTC" });
    const listed = await taskTools("alice").list_scheduled_tasks.execute!({}, { toolCallId: "list", messages: [], context: {} });
    expect(listed).toEqual([expect.objectContaining({ cronExpression: "0 * * * *", timeZone: "UTC", enabled: false })]);
  });
  it("skips missed recurrences without drifting from the original slot", () => {
    expect(nextCronOccurrence("30 * * * *", "UTC", new Date("2026-11-06T05:45:00Z"))?.toISOString()).toBe("2026-11-06T06:30:00.000Z");
  });
});

describe("scheduled execution", () => {
  it("claims atomically across concurrent ticks and saves a result chat as the owner", async () => {
    const id = await due();
    await Promise.all([runDueTasks("https://app.test"), runDueTasks("https://app.test")]);
    expect(generateAgentReply).toHaveBeenCalledTimes(1);
    expect(generateAgentReply).toHaveBeenCalledWith(expect.objectContaining({ userId: "alice", scheduled: true, script: "[]" }));
    expect(consumeChatMessage).toHaveBeenCalledTimes(1);
    const runs = await db.select().from(taskRuns).where(eq(taskRuns.taskId, id));
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("succeeded");
    const chat = await loadChat("alice", runs[0].chatId!);
    expect(chat?.messages.at(-1)?.parts).toEqual([{ type: "text", text: "Weather report" }]);
    expect(await loadChat("bob", runs[0].chatId!)).toBeNull();
    expect((await getTask("alice", id)).nextRunAt.getTime()).toBeGreaterThan(Date.now());
  });
  it("consumes a one-shot occurrence and does not run paused tasks", async () => {
    const once = await due("alice", null);
    const paused = await due("bob");
    await db.update(scheduledTasks).set({ enabled: false }).where(eq(scheduledTasks.id, paused));
    await runDueTasks("https://app.test");
    await runDueTasks("https://app.test");
    expect(generateAgentReply).toHaveBeenCalledTimes(1);
    expect((await getTask("alice", once)).enabled).toBe(false);
  });
  it("records failures without secrets, releases the lease and never retries the occurrence", async () => {
    const id = await due("alice", null);
    vi.mocked(generateAgentReply).mockRejectedValueOnce(new Error("Provider rejected Authorization: Bearer secret-token"));
    await runDueTasks("https://app.test");
    await runDueTasks("https://app.test");
    const [run] = await db.select().from(taskRuns).where(eq(taskRuns.taskId, id));
    expect(run.status).toBe("failed");
    expect(run.error).not.toContain("secret-token");
    expect((await getTask("alice", id)).leaseId).toBeNull();
    expect(generateAgentReply).toHaveBeenCalledTimes(1);
  });
  it("does not edit a task during its execution lease", async () => {
    const id = await due();
    await db.update(scheduledTasks).set({ leaseId: "running", leaseUntil: new Date(Date.now() + 60_000) }).where(eq(scheduledTasks.id, id));
    await expect(saveTask("alice", definition(), id)).rejects.toThrow();
    expect(await runDueTasks("https://app.test")).toEqual([]);
  });
});


describe("manual execution", () => {
  it("persists live reply snapshots before completion and keeps the final tool history", async () => {
    const id = await saveTask("alice", definition());
    const { task, runId } = await claimManualTask("alice", id);
    const chatId = `task-${runId}`;
    vi.mocked(generateAgentReply).mockImplementationOnce(async options => {
      await options.onProgress!({ id: "temporary", role: "assistant", parts: [{ type: "text", text: "Checking weather…" }] });
      expect((await loadChat("alice", chatId))?.messages.at(-1)?.parts).toEqual([{ type: "text", text: "Checking weather…" }]);
      expect(await chatRun("alice", chatId)).toMatchObject({ status: "running" });
      expect(await chatRun("bob", chatId)).toBeNull();
      await options.onProgress!({ id: "temporary", role: "assistant", parts: [{ type: "text", text: "Checking weather…" }, { type: "step-start" }, { type: "text", text: "Sunny" }] });
      return { text: "Sunny", visuals: [] };
    });
    await executeTaskRun(task, runId, "https://app.test", true);
    const chat = await loadChat("alice", chatId);
    expect(chat?.messages).toHaveLength(2);
    expect(chat?.messages.at(-1)?.parts).toHaveLength(3);
    expect(await chatRun("alice", chatId)).toMatchObject({ status: "succeeded" });
  });

  it("reports an abandoned run instead of polling forever", async () => {
    const id = await saveTask("alice", definition());
    const { runId } = await claimManualTask("alice", id);
    const chatId = `task-${runId}`;
    await db.update(taskRuns).set({ chatId }).where(eq(taskRuns.id, runId));
    await db.update(scheduledTasks).set({ leaseUntil: new Date(Date.now() - 1) }).where(eq(scheduledTasks.id, id));
    expect(await chatRun("alice", chatId)).toMatchObject({ status: "failed", error: expect.stringContaining("timed out") });
  });

  it("runs a paused task as its owner and preserves its next scheduled time", async () => {
    const id = await saveTask("alice", definition(), undefined, false);
    const before = await getTask("alice", id);
    const { task, runId } = await claimManualTask("alice", id);
    expect((await db.select().from(taskRuns).where(eq(taskRuns.id, runId)))[0].status).toBe("running");
    expect(await executeTaskRun(task, runId, "https://app.test", true)).toBe("succeeded");
    const after = await getTask("alice", id);
    expect(after.enabled).toBe(false);
    expect(after.nextRunAt).toEqual(before.nextRunAt);
    expect(after.leaseId).toBeNull();
    const [run] = await db.select().from(taskRuns).where(eq(taskRuns.id, runId));
    expect(run.finishedAt).toBeInstanceOf(Date);
    expect((await loadChat("alice", run.chatId!))?.messages.at(-1)?.role).toBe("assistant");
  });
  it("rejects other owners and prevents duplicate manual and cron execution", async () => {
    const id = await due();
    await expect(claimManualTask("bob", id)).rejects.toThrow("NOT_FOUND");
    const claims = await Promise.allSettled([claimManualTask("alice", id), claimManualTask("alice", id)]);
    expect(claims.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(await runDueTasks("https://app.test")).toEqual([]);
    expect(generateAgentReply).not.toHaveBeenCalled();
    const claimed = claims.find(result => result.status === "fulfilled")!;
    if (claimed.status !== "fulfilled") throw new Error("Expected a successful claim");
    await executeTaskRun(claimed.value.task, claimed.value.runId, "https://app.test", true);
    expect(generateAgentReply).toHaveBeenCalledTimes(1);
    expect((await getTask("alice", id)).nextRunAt.getTime()).toBeLessThan(Date.now());
  });
  it("preserves an enabled one-time schedule and records manual failures safely", async () => {
    const id = await saveTask("alice", { ...definition(), cronExpression: null });
    const before = await getTask("alice", id);
    const { task, runId } = await claimManualTask("alice", id);
    vi.mocked(generateAgentReply).mockRejectedValueOnce(new Error("Provider rejected Authorization: Bearer secret-token"));
    expect(await executeTaskRun(task, runId, "https://app.test", true)).toBe("failed");
    const after = await getTask("alice", id);
    expect(after.enabled).toBe(true);
    expect(after.nextRunAt).toEqual(before.nextRunAt);
    expect(after.leaseId).toBeNull();
    const [run] = await db.select().from(taskRuns).where(eq(taskRuns.id, runId));
    expect(run.error).not.toContain("secret-token");
    expect(run.status).toBe("failed");
  });
});


describe("run usage accounting", () => {
  it("records accepted chat consumption and tool attempts even when the run fails", async () => {
    const id = await saveTask("alice", definition());
    const { task, runId } = await claimManualTask("alice", id);
    vi.mocked(consumeChatMessage).mockResolvedValueOnce({ allowed: true, used: 1, limit: 100, remaining: 99, chargedUnits: 2, periodEnd: null, duplicate: false });
    vi.mocked(generateAgentReply).mockImplementationOnce(async options => {
      await options.onMcpCall!();
      await recordTaskMcpUsage({ userId: "alice", runId, premium: true, chargedUnits: 3 });
      throw new Error("upstream failed");
    });
    await executeTaskRun(task, runId, "https://app.test", true);
    const [run] = await db.select().from(taskRuns).where(eq(taskRuns.id, runId));
    expect(run).toMatchObject({ status: "failed", usageTracked: true, trigger: "manual", chatUnits: 1, chatChargedUnits: 2, mcpCalls: 1, mcpUnits: 0, premiumMcpUnits: 1, mcpChargedUnits: 3 });
  });
  it("isolates consumption by run and owner and increments concurrent MCP charges", async () => {
    const id = await saveTask("alice", definition());
    const { runId } = await claimManualTask("alice", id);
    await recordTaskMcpUsage({ userId: "bob", runId, premium: true, chargedUnits: 100 });
    await Promise.all(Array.from({ length: 3 }, () => recordTaskMcpUsage({ userId: "alice", runId, premium: false, chargedUnits: 0.5 })));
    const [run] = await db.select().from(taskRuns).where(eq(taskRuns.id, runId));
    expect(run).toMatchObject({ mcpUnits: 3, premiumMcpUnits: 0, mcpChargedUnits: 1.5 });
  });
});
