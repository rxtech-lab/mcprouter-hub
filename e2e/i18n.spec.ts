import { expect, test } from "@playwright/test";

test.describe("language detection", () => {
  test.use({ locale: "zh-HK" });

  test("follows the browser's language until one is picked", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-HK");
  });
});

test("the language menu saves the choice across pages", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByRole("banner").getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitemradio", { name: "简体中文" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  expect((await context.cookies()).find((cookie) => cookie.name === "locale")?.value).toBe("zh-CN");

  // The dashboard rail has the same menu, and the choice carries over.
  // Open the tour deterministically and dismiss it before opening another overlay.
  // A locator handler can run after the language menu opens, which hides the tour
  // from accessible locators and blocks the handler's own dismiss action.
  await page.goto("/dashboard?intro=all");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  const intro = page.getByRole("dialog").filter({ has: page.getByTestId("intro-card") });
  await expect(intro).toBeVisible();
  await intro.getByRole("button", { name: "跳过", exact: true }).click();
  await expect(page.getByTestId("intro-card")).toBeHidden();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("navigation").getByRole("button", { name: "语言" }).click();
  await expect(page.getByRole("menuitemradio", { name: "简体中文" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
