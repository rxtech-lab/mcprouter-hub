import { expect, test } from "@playwright/test";

test("keeps connection fields after failed submissions", async ({ page }) => {
  await page.goto("/mcp-clients?connect=1");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("Chippy");
  // A literal private address fails deterministically before any network or DB write.
  await dialog.getByLabel("MCP server URL").fill("https://127.0.0.1/mcp");
  await dialog.getByText("Pre-registered OAuth client (optional)", { exact: true }).click();
  await dialog.getByLabel("Client ID", { exact: true }).fill("registered-client");
  await dialog.getByLabel("Client secret", { exact: true }).fill("registered-secret");

  for (let attempt = 0; attempt < 2; attempt++) {
    const submit = dialog.getByRole("button", { name: "Continue with OAuth" });
    await submit.click();
    await expect(page.getByTestId("snackbar")).toContainText("Something went wrong");
    await expect(submit).toBeEnabled();
    await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue("Chippy");
    await expect(dialog.getByLabel("MCP server URL")).toHaveValue("https://127.0.0.1/mcp");
    await expect(dialog.getByLabel("Client ID", { exact: true })).toHaveValue("registered-client");
    await expect(dialog.getByLabel("Client secret", { exact: true })).toHaveValue("registered-secret");
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/connect=1/);
  }
});

test("opens MCP tools and account in a URL-driven native dialog", async ({ page }) => {
  const { createClient } = await import("@libsql/client");
  const db = createClient({ url: process.env.TURSO_DATABASE_URL ?? "file:e2e.db" });
  const id = crypto.randomUUID();
  const otherId = crypto.randomUUID();
  const name = `MCP details ${id.slice(0, 8)}`;
  try {
    // Invalid sealed credentials simulate an unavailable provider without network calls.
    for (const [clientId, owner] of [[id, "local-development-user"], [otherId, "another-user"]]) {
      await db.execute({ sql: "INSERT INTO external_mcp_clients (id, user_id, name, url, redirect_uri, credentials, connected) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [clientId, owner, name, "https://example.com/mcp", "https://example.com/callback", "unreadable-test-credentials", 1] });
    }
    await page.goto("/mcp-clients");
    await page.getByRole("link", { name: `View ${name} tools and account`, exact: true }).click();
    const dialog = page.getByRole("dialog", { name, exact: true });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`client=${id}&tab=tools`));
    await expect(dialog.getByRole("heading", { name: "Available tools" })).toBeVisible();
    await expect(dialog.getByRole("alert")).toContainText("Could not load tools");
    await expect(dialog).toContainText("Tools are cached for 2 hours");
    await dialog.getByRole("button", { name: "Reload tools" }).click();
    await expect(page.getByTestId("snackbar")).toContainText("Something went wrong");
    await expect(dialog.getByRole("button", { name: "Reload tools" })).toBeEnabled();
    await dialog.getByRole("link", { name: "Account", exact: true }).click();
    await expect(page).toHaveURL(/tab=account/);
    await expect(dialog.getByRole("heading", { name: "Connected account" })).toBeVisible();
    await expect(dialog).toContainText("Account details are unavailable");
    await page.reload();
    await expect(dialog.getByRole("heading", { name: "Connected account" })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: "/private/tmp/mcprouter-client-details-mobile.png", animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/mcp-clients$/);
    await expect(dialog).not.toBeVisible();
    await page.goto(`/mcp-clients?client=${otherId}&tab=account`);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } finally {
    await db.execute({ sql: "DELETE FROM external_mcp_clients WHERE id IN (?, ?)", args: [id, otherId] });
    db.close();
  }
});

test("reuses persisted tools on reopening and keeps them when manual reload fails", async ({ page }) => {
  const { createClient } = await import("@libsql/client");
  const db = createClient({ url: process.env.TURSO_DATABASE_URL ?? "file:e2e.db" });
  const id = crypto.randomUUID();
  const name = `Cached MCP ${id.slice(0, 8)}`;
  const tools = [{ name: "cached_tool", title: "Cached tool", description: "Available from the server cache" }, ...Array.from({ length: 40 }, (_, index) => ({ name: `tool_${index}`, title: `Tool ${index}`, description: "A tool description that makes this list long enough to scroll." }))];
  try {
    await db.execute({ sql: "INSERT INTO external_mcp_clients (id, user_id, name, url, redirect_uri, credentials, connected, tools_cache) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", args: [id, "local-development-user", name, "https://example.com/mcp", "https://example.com/callback", "unreadable-test-credentials", 1, JSON.stringify({ tools, fetchedAt: Date.now() })] });
    await page.goto(`/mcp-clients?client=${id}&tab=tools`);
    const dialog = page.getByRole("dialog", { name, exact: true });
    await expect(dialog.getByRole("heading", { name: "Available tools (41)", exact: true })).toBeVisible();
    await expect(dialog).toContainText("Available from the server cache");
    for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const list = dialog.getByRole("list", { name: "MCP tools" });
      const tabs = dialog.getByRole("navigation", { name: "MCP client details" });
      const close = dialog.getByRole("button", { name: "Close", exact: true });
      await expect.poll(() => list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
      const beforeTabs = await tabs.boundingBox();
      const beforeClose = await close.boundingBox();
      await list.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      await expect(dialog.getByRole("heading", { name: "Tool 39", exact: true })).toBeInViewport();
      expect((await tabs.boundingBox())?.y).toBe(beforeTabs?.y);
      expect((await close.boundingBox())?.y).toBe(beforeClose?.y);
      await expect(tabs).toBeInViewport();
      await expect(close).toBeInViewport();
      expect(await dialog.evaluate((element) => element.scrollTop)).toBe(0);
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: `/private/tmp/mcprouter-tools-fixed-${viewport.width}.png`, animations: "disabled" });
    }
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("link", { name: `View ${name} tools and account`, exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Cached tool", exact: true })).toBeVisible();
    await page.reload();
    await expect(dialog.getByRole("heading", { name: "Cached tool", exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Reload tools", exact: true }).click();
    await expect(page.getByTestId("snackbar")).toContainText("Something went wrong");
    await expect(dialog.getByRole("button", { name: "Reload tools", exact: true })).toBeEnabled();
    await expect(dialog.getByRole("heading", { name: "Cached tool", exact: true })).toBeVisible();
  } finally {
    await db.execute({ sql: "DELETE FROM external_mcp_clients WHERE id = ?", args: [id] });
    db.close();
  }
});
