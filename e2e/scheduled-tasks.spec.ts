import { expect, test } from "@playwright/test";

test("creates, edits, pauses and deletes a scheduled task through dedicated views", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New task", exact: true }).click();
  await expect(page.getByRole("heading", { name: "New scheduled task" })).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill(`Browser task ${Date.now()}`);
  await page.getByLabel("Instructions", { exact: true }).fill("Summarize today's weather");
  await page.getByLabel("Cron expression", { exact: true }).fill("0 9 * * 1-5");
  await page.getByLabel("Time zone", { exact: true }).fill("Asia/Shanghai");
  await page.getByRole("button", { name: "Save scheduled task" }).click();
  await expect(page).toHaveURL(/\/tasks\/[a-f0-9-]+$/);
  await expect(page.getByText("Scheduled task saved", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Your scheduled tasks" })).toBeVisible();
  await expect(page.getByText("0 9 * * 1-5 (Asia/Shanghai)", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Next scheduled run" })).toBeVisible();
  await page.getByRole("link", { name: "Run now", exact: true }).click();
  const manual = page.getByRole("dialog", { name: "Run scheduled task now" });
  await expect(manual).toBeVisible();
  await expect(manual).toContainText("Its schedule and paused state will stay unchanged");
  await manual.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("link", { name: "Run history", exact: true }).click();
  await expect(page).toHaveURL(/tab=history/);
  await expect(page.getByRole("heading", { name: "No runs yet" })).toBeVisible();
  await page.getByRole("navigation", { name: "Task details" }).getByRole("link", { name: "Overview", exact: true }).click();
  await page.getByRole("link", { name: "Pause", exact: true }).click();
  const pause = page.getByRole("dialog", { name: "Pause scheduled task" });
  await expect(pause).toBeVisible();
  await pause.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByText("Paused — review and enable to run", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByLabel("Instructions", { exact: true }).fill("Report weather and warnings");
  await page.getByRole("button", { name: "Save scheduled task" }).click();
  await expect(page.getByText("Report weather and warnings", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Delete", exact: true }).click();
  const remove = page.getByRole("dialog", { name: "Delete scheduled task" });
  await expect(remove).toBeVisible();
  await remove.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks$/);
});

test("opens the native OAuth dialog from the sidebar and keeps secrets out of the URL", async ({ page }) => {
  await page.goto("/mcp-clients");
  await page.getByRole("link", { name: "Connect MCP client", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Connect MCP client" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Name", { exact: true }).fill("Private endpoint");
  await dialog.getByLabel("MCP server URL").fill("https://127.0.0.1/mcp");
  await dialog.getByRole("button", { name: "Continue with OAuth" }).click();
  await expect(page.getByTestId("snackbar")).toContainText("Something went wrong");
  await expect(dialog).toBeVisible();
  expect(page.url()).not.toContain("127.0.0.1");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/mcp-clients$/);
});


test("keeps task creation usable on mobile and opens the shared agent from task links", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tasks/new");
  await expect(page.getByLabel("Instructions", { exact: true })).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill("Mobile scheduled task");
  await page.getByLabel("Instructions", { exact: true }).fill("Summarize weather");
  await page.screenshot({ path: test.info().outputPath("mcprouter-tasks-mobile.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/tasks");
  await page.getByRole("link", { name: "Build with the agent", exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByText("Help me write an MCP workflow script", { exact: true })).toBeVisible();
});


test("redirects the former task agent to the shared agent", async ({ page }) => {
  await page.goto("/taskagent");
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByText("Help me write an MCP workflow script", { exact: true })).toBeVisible();
});
