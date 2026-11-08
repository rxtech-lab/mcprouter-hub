import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { expect, test } from "@playwright/test";
import { chats, chatMessages, scheduledTasks, taskRuns } from "../db/schema";

for (const outcome of ["succeeded", "failed"] as const) {
  test(`follows a background task reply without reload until ${outcome}`, async ({ page }) => {
    const client = createClient({ url: "file:e2e.db" });
    const db = drizzle(client);
    const id = crypto.randomUUID();
    const runId = crypto.randomUUID();
    const chatId = `task-${runId}`;
    const answerId = `answer-${runId}`;
    try {
      await db.insert(scheduledTasks).values({ id, userId: "local-development-user", title: "Live task", prompt: "Find today's weather", nextRunAt: new Date(Date.now() + 3600_000), leaseId: runId, leaseUntil: new Date(Date.now() + 600_000) });
      await db.insert(chats).values({ id: chatId, userId: "local-development-user", title: "Live task" });
      await db.insert(chatMessages).values({ id: `input-${runId}`, chatId, role: "user", position: 0, parts: [{ type: "text", text: "Find today's weather" }] });
      await db.insert(taskRuns).values({ id: runId, taskId: id, chatId, status: "running" });
      await page.goto(`/chat/${chatId}`);
      await expect(page.getByTestId("typing-dots")).toBeVisible();
      await expect(page.getByTestId("snackbar")).toContainText("Task is running");
      await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Stop", exact: true })).toHaveCount(0);
      await db.insert(chatMessages).values({ id: answerId, chatId, role: "assistant", position: 1, parts: [{ type: "text", text: "Checking the live forecast…", state: "streaming" }] });
      await expect(page.getByTestId("agent-message")).toContainText("Checking the live forecast…");
      if (outcome === "succeeded") {
        await db.update(chatMessages).set({ parts: [{ type: "text", text: "Today's forecast: sunny.", state: "done" }] }).where(eq(chatMessages.id, answerId));
      }
      await db.update(taskRuns).set({ status: outcome, finishedAt: new Date(), error: outcome === "failed" ? "Running agent and MCP workflow\nMCP connection oauth_fixture failed\nHTTP 401: reconnect the account" : null }).where(eq(taskRuns.id, runId));
      await expect(page.getByTestId("typing-dots")).toHaveCount(0);
      await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeEnabled();
      if (outcome === "succeeded") {
        await expect(page.getByTestId("agent-message")).toContainText("Today's forecast: sunny.");
        await expect(page.getByTestId("snackbar")).toHaveCount(0);
      } else {
        await expect(page.getByTestId("snackbar")).toContainText("Task failed");
        await page.getByTestId("snackbar").getByRole("button", { name: "Error details", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Error details", exact: true });
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText("MCP connection oauth_fixture failed");
        await expect(dialog).toContainText("HTTP 401: reconnect the account");
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await page.getByRole("link", { name: "Error details", exact: true }).click();
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: "Close", exact: true }).click();
        await page.goto(`/tasks/${id}?tab=history`);
        await page.getByRole("link", { name: "Error details", exact: true }).click();
        await expect(dialog).toContainText("HTTP 401: reconnect the account");
        await dialog.getByRole("button", { name: "Close", exact: true }).click();
        await page.goto(`/chat/${chatId}`);
      }
      expect(page.url()).toContain(`/chat/${chatId}`);
      // Snapshot reads never expose another owner's chat.
      await db.update(chats).set({ userId: "another-owner" }).where(eq(chats.id, chatId));
      expect((await page.request.get(`/api/chat/${chatId}`)).status()).toBe(404);
    } finally {
      await db.delete(taskRuns).where(eq(taskRuns.id, runId));
      await db.delete(scheduledTasks).where(eq(scheduledTasks.id, id));
      await db.delete(chatMessages).where(eq(chatMessages.chatId, chatId));
      await db.delete(chats).where(eq(chats.id, chatId));
      client.close();
    }
  });
}
