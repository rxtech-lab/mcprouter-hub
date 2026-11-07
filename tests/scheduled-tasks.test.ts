import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { db, scheduledTasks, taskRuns } from "@/db";
import { getTask, listTasks, saveTask } from "@/lib/tasks/store";
import { nextOccurrence, taskSchema } from "@/lib/tasks/definition";
import { loadChat } from "@/lib/chat-store";

vi.mock("@/lib/agent/run", () => ({ generateAgentReply: vi.fn(async () => ({ text: "Weather report", visuals: [] })) }));
vi.mock("@/lib/billing/chat", () => ({ consumeChatMessage: vi.fn() }));
import { generateAgentReply } from "@/lib/agent/run";
import { consumeChatMessage } from "@/lib/billing/chat";
import { runDueTasks } from "@/lib/tasks/runner";
import { taskTools } from "@/lib/tasks/agent-tools";

const definition = () => ({ title: "Weather", prompt: "Report weather", runAt: new Date(Date.now() + 3600_000).toISOString(), intervalMinutes: 60 as const, script: "[]" });
beforeAll(async () => { await migrate(db, { migrationsFolder: "db/migrations" }); process.env.MCPROUTER_INTERNAL_KEY = "test-only-key"; });
beforeEach(async () => { await db.delete(taskRuns); await db.delete(scheduledTasks); vi.clearAllMocks(); });

async function due(userId = "alice", intervalMinutes: 60 | null = 60) {
  const id = await saveTask(userId, { ...definition(), intervalMinutes });
  await db.update(scheduledTasks).set({ nextRunAt: new Date(Date.now() - 1000) }).where(eq(scheduledTasks.id, id));
  return id;
}

describe("scheduled task validation and isolation", () => {
  it("rejects arbitrary code, excessive steps, invalid repeats and timestamps", () => {
    for (const script of ["fetch('https://evil.test')", JSON.stringify(Array(21).fill({ tool: "weather", arguments: {} })), '[{"tool":"../shell"}]']) expect(taskSchema.safeParse({ ...definition(), script }).success).toBe(false);
    expect(taskSchema.safeParse({ ...definition(), runAt: "tomorrow" }).success).toBe(false);
    expect(taskSchema.safeParse({ ...definition(), intervalMinutes: 1 }).success).toBe(false);
    expect(taskSchema.safeParse({ ...definition(), script: '[{"tool":"oauth_abc__read","arguments":{"count":3}}]' }).success).toBe(true);
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
    const result = await tool.execute!(definition(), { toolCallId: "draft", messages: [], context: {} });
    expect(result).toMatchObject({ enabled: false, label: "Review scheduled task" });
    expect((await listTasks("alice"))[0].enabled).toBe(false);
  });
  it("skips missed recurrences without drifting from the original slot", () => {
    const start = new Date("2026-11-06T01:30:00Z");
    expect(nextOccurrence(start, 60, new Date("2026-11-06T05:45:00Z"))?.toISOString()).toBe("2026-11-06T06:30:00.000Z");
    expect(nextOccurrence(start, null, start)).toBeNull();
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
    vi.mocked(generateAgentReply).mockRejectedValueOnce(new Error("secret-token"));
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
