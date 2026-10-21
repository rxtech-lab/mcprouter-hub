import { expect, test } from "@playwright/test";

test("localized service HTML exposes canonical, hreflang, RxLab and unique metadata before JavaScript", async ({ request }) => {
  const response = await request.get("/zh-HK/sources/hko-weather?chat=1&fullscreen=1", { headers: { "Accept-Language": "en", "User-Agent": "Googlebot" } });
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('lang="zh-HK"');
  expect(html).toContain('rel="canonical" href="http://localhost:3199/zh-HK/sources/hko-weather"');
  expect(html).toContain('hrefLang="en"');
  expect(html).toContain('hrefLang="zh-CN"');
  expect(html).toContain('href="https://rxlab.app"');
  expect(html).toContain('"@type":"Organization"');
  expect(html).toContain("香港天氣與警告 MCP");
});

test("metadata keeps pagination and excludes searches and private pages", async ({ page }) => {
  await page.goto("/en/sources/apis?page=2");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "http://localhost:3199/en/sources/apis?page=2");
  await page.goto("/en/sources/apis?q=weather");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.goto("/login");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("guides, language changes, and search navigation retain stable locale URLs", async ({ page }) => {
  await page.goto("/zh-HK/guides/cursor?method=api-key");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Cursor");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "http://localhost:3199/zh-HK/guides/cursor");
  await page.getByRole("banner").getByRole("button", { name: "搜尋", exact: true }).click();
  await page.getByRole("dialog", { name: "搜尋", exact: true }).getByRole("option", { name: "數據來源", exact: true }).click();
  await expect(page).toHaveURL(/\/zh-HK\/sources$/);
  await page.goto("/zh-HK/sources/providers");
  await expect(page.getByRole("search")).toHaveAttribute("action", "/zh-HK/sources/providers");
  await page.getByRole("banner").getByRole("button", { name: "語言" }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/sources\/providers$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("robots and sitemap publish canonical content, excluding account and transient states", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("Sitemap: http://localhost:3199/sitemap.xml");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  expect(xml).toContain("/en/sources/hko-weather</loc>");
  expect(xml).toContain("/zh-HK/guides/cursor</loc>");
  expect(xml).not.toMatch(/\/dashboard|\/keys|\?chat=|\?q=/);
});

test("API detail pages have their own canonical and return 404 for unknown IDs", async ({ page, request }) => {
  // The public tracker links to the full detail page from its existing dialog.
  await page.goto("/en/sources/hko-weather");
  const link = page.locator('a[href^="/en/sources/api/"]').first();
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  await link.click();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `http://localhost:3199${href}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect((await request.get("/en/sources/api/does-not-exist")).status()).toBe(404);
  expect((await request.get("/en/guides/does-not-exist")).status()).toBe(404);
});

test("public guides and service content fit a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/en/guides", "/zh-HK/guides/cursor", "/en/sources/hko-weather"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.screenshot({ path: "/tmp/mcprouter-seo-service-mobile.png", fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/en/guides/cursor");
  await page.screenshot({ path: "/tmp/mcprouter-seo-guide-desktop.png", fullPage: true, animations: "disabled" });
});
