import { expect, test } from "@playwright/test";

test.skip(!process.env.BILLING_SIM_URL, "Requires the local chat-billing Postman simulation");

test("shows authoritative usage separately from stored credits", async ({ page }) => {
  await page.goto("/billing");
  const limits = page.locator("section").filter({ has: page.getByRole("heading", { name: "Usage limits", exact: true }) });
  await expect(limits).toContainText("1 / ∞");
  await expect(limits).toContainText("1 / 2");
  await expect(limits).toContainText("0 / 0");
  await expect(page.getByText("10,000 mcp-calls · 500 Chat points · 50 Premium MCP points", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Stored credits and history" }).click();
  await expect(page).toHaveURL(/\/usage\/credits$/);
  await expect(page.getByText("7 MCP credits", { exact: true })).toBeVisible();
});

test("keeps the premium meter in the URL when changing the date range", async ({ page }) => {
  await page.goto("/usage?days=7&meter=premium");
  await expect(page.getByRole("link", { name: "Premium MCP calls", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "14 days", exact: true }).click();
  await expect(page).toHaveURL(/days=14&meter=premium/);
  await page.getByRole("link", { name: "MCP calls", exact: true }).click();
  await expect(page).toHaveURL(/days=14&meter=standard/);
});
