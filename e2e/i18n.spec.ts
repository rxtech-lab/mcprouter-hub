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
  await page.goto("/dashboard");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.getByRole("navigation").getByRole("button", { name: "语言" }).click();
  await expect(page.getByRole("menuitemradio", { name: "简体中文" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
