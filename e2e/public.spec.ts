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
