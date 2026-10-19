import { expect, test } from "@playwright/test";

test("data sources: services, a service's tools, and provider search", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Read more about the data sources" }).click();
  await expect(page.getByRole("heading", { name: "Data sources" })).toBeVisible();

  await page.getByRole("link", { name: /Hong Kong Observatory Weather/ }).click();
  await expect(page.getByRole("heading", { name: "Hong Kong Observatory Weather" })).toBeVisible();
  await expect(page.getByText("hko_current_weather")).toBeVisible();

  await page.goto("/sources/providers?q=zzzz-no-such-provider");
  await expect(page.getByText("No providers match")).toBeVisible();
});

test("the landing page hero is a live free chat", async ({ page }) => {
  await page.goto("/");
  const chat = page.getByTestId("hero-chat");
  await expect(chat.getByRole("textbox", { name: "Message" })).toBeVisible();
  await expect(chat.getByRole("status")).toContainText(/free messages left today/);
});

test("landing pricing links to dedicated billing on desktop and mobile", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "View pricing", exact: true }).click();
  await expect(page).toHaveURL(/#pricing$/);
  const pricing = page.locator("section#pricing");
  await expect(pricing.getByRole("heading", { name: "A plan for every assistant" })).toBeVisible();
  await expect(pricing.locator('a[href="/billing"]').first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await pricing.scrollIntoViewIfNeeded();
  await expect(pricing.getByRole("heading", { name: "A plan for every assistant" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("API tracker: filter by status and open an API's details", async ({ page }) => {
  await page.goto("/sources");
  await page.getByRole("link", { name: /^APIs/ }).click();
  await expect(page).toHaveURL(/\/sources\/apis$/);
  await page.getByRole("link", { name: /^Coming soon/ }).click();
  await expect(page).toHaveURL(/status=coming-soon/);
  await expect(page.getByTestId("api-list").getByText("Implemented")).toHaveCount(0);

  await page.goto("/sources/apis?api=API-0014");
  const dialog = page.getByRole("dialog", { name: "MTR next train" });
  await expect(dialog.getByText("API-0014")).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(/\/sources\/apis$/);
});
