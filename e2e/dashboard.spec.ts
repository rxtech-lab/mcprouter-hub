import { expect, test } from "@playwright/test";

test("create a key, see it once, then revoke it", async ({ page }) => {
  const name = `e2e key ${Date.now()}`;
  await page.goto("/keys");
  await page.getByRole("button", { name: "Create key" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("checkbox", { name: "Buses & Minibuses" }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();

  const revealed = page.getByTestId("revealed-key");
  await expect(revealed).toContainText(/mcpr_[A-Za-z0-9_-]{32}/);
  await expect(page.getByTestId("snackbar")).toContainText("Key created");
  const key = (await revealed.locator("pre").textContent())!.trim();

  // The key works against the MCP endpoint and only sees its scoped service.
  const list = await page.request.post("/api/mcp/streamable", {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
  });
  const body = await list.text();
  expect(body).toContain("kmb_stop_eta");
  expect(body).not.toContain("hko_current_weather");

  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText(key)).toHaveCount(0);

  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Revoke" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByTestId("snackbar")).toContainText("Key revoked");
  await expect(page.getByTestId("key-card").filter({ hasText: name })).toContainText("Revoked");

  const denied = await page.request.post("/api/mcp/streamable", {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json, text/event-stream" },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
  });
  expect(denied.status()).toBe(401);
});

test("tracker and services pages load", async ({ page }) => {
  await page.goto("/tracker");
  await expect(page.getByRole("heading", { name: "Conversion tracker" })).toBeVisible();
  await page.getByRole("navigation", { name: "Tracker views" }).getByRole("link", { name: "Datasets" }).click();
  await expect(page).toHaveURL(/\/tracker\/datasets/);
  await page.goto("/services");
  await expect(page.getByRole("heading", { name: "Services", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: /^Hong Kong Observatory Weather/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Hong Kong Observatory Weather" })).toBeVisible();
  await expect(dialog).toContainText("hko_current_weather");
  await dialog.getByRole("button", { name: "Input schema" }).first().click();
  await expect(dialog).toContainText("Input JSON Schema");
});

test("the agent shows tool calls", async ({ page }) => {
  test.skip(!process.env.AI_GATEWAY_API_KEY || !process.env.MCPROUTER_INTERNAL_KEY, "needs AI_GATEWAY_API_KEY and MCPROUTER_INTERNAL_KEY");
  await page.goto("/chat");
  await page.getByLabel("Message").fill("What is the current temperature at the Hong Kong Observatory?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("tool-call").first()).toContainText("hko_", { timeout: 60_000 });
});
