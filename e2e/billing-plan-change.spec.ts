import { expect, test } from "@playwright/test";

// Run with the local plan-change Postman simulation, never a live billing API.
test.skip(process.env.PLAN_CHANGE_SIMULATION !== "true", "Requires plan-change simulation fixtures");

test("plan changes use a native URL-driven dialog and can be cancelled", async ({ page }) => {
  await page.goto("/billing");
  await page.getByRole("link", { name: "Change plan", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Change plan", exact: true });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.matches("dialog:modal"))).toBe(true);
  await expect(page).toHaveURL(/changePlan=new/);
  await expect(dialog).toContainText("Pay as you go");
  await expect(dialog).toContainText("Pro");
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/changePlan=/);
});

test("review failures show inside the modal and can be retried", async ({ page }) => {
  await page.goto("/billing?changePlan=new");
  const dialog = page.getByRole("dialog", { name: "Change plan", exact: true });
  await page.route("**/billing*", (route) => route.request().method() === "POST" ? route.abort("failed") : route.continue());
  await dialog.getByRole("button", { name: "Review with Stripe" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByRole("button", { name: "Dismiss" }).click();
  await page.unroute("**/billing*");
  await page.route("https://billing.stripe.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>Simulated Stripe review</title>" }));
  await dialog.getByRole("button", { name: "Review with Stripe" }).click();
  await expect(page).toHaveURL("https://billing.stripe.com/p/session/simulated");
});

test("the plan change dialog fits a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/billing?changePlan=new");
  const dialog = page.getByRole("dialog", { name: "Change plan", exact: true });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.scrollWidth <= window.innerWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).not.toHaveURL(/changePlan=/);
});
