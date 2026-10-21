import { expect, test } from "@playwright/test";

// Run with the local plan-change Postman simulation, never a live billing API.
test.skip(process.env.PLAN_CHANGE_SIMULATION !== "true", "Requires plan-change simulation fixtures");

test.beforeEach(async ({ page, request }) => {
  await request.post("http://127.0.0.1:4922/subscription/test/ui", { data: { provider: "stripe", oldAmount: 1000, newAmount: 2000 } });
  await page.route("https://billing.stripe.com/**", (route) => route.fulfill({ body: "Simulated Stripe review" }));
  await page.route("https://checkout.stripe.com/**", (route) => route.fulfill({ body: "Simulated Stripe setup" }));
});

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


for (const scenario of [
  { name: "1 free upgrade now", provider: "internal", oldAmount: 0, newAmount: 2000, timing: "immediate" },
  { name: "2 free upgrade next period", provider: "internal", oldAmount: 0, newAmount: 2000, timing: "next_period" },
  { name: "3 $10 to $20 now", provider: "stripe", oldAmount: 1000, newAmount: 2000, timing: "immediate" },
  { name: "4 $10 to $20 next period", provider: "stripe", oldAmount: 1000, newAmount: 2000, timing: "next_period" },
  { name: "6 $20 to $10 next period", provider: "stripe", oldAmount: 2000, newAmount: 1000, timing: "next_period" },
]) {
  test(scenario.name, async ({ page, request }) => {
    const mockURL = "http://127.0.0.1:4922/subscription/test/ui";
    expect((await request.post(mockURL, { data: scenario })).ok()).toBe(true);
    await page.goto("/billing?changePlan=new");
    const dialog = page.getByRole("dialog", { name: "Change plan", exact: true });
    await expect(dialog).toBeVisible();
    if (scenario.oldAmount > scenario.newAmount) {
      // Case 5: an immediate downgrade is not offered in the UI either.
      await expect(dialog.getByRole("radio", { name: /Immediately/ })).toHaveCount(0);
    }
    if (scenario.timing === "next_period") {
      await dialog.getByRole("radio", { name: /At the next billing period/ }).check();
      if (scenario.oldAmount <= scenario.newAmount) await expect(page).toHaveURL(/timing=next_period/);
    }
    await page.route("https://billing.stripe.com/**", (route) => route.fulfill({ body: "Simulated review" }));
    await page.route("https://checkout.stripe.com/**", (route) => route.fulfill({ body: "Simulated payment setup" }));
    await dialog.getByRole("button", { name: "Review with Stripe" }).click();
    await expect(page).toHaveURL(scenario.timing === "next_period" ? /checkout.stripe.com/ : /billing.stripe.com/);
    expect((await (await request.get(mockURL)).json()).lastTiming).toBe(scenario.timing);
  });
}


test("Plus can schedule an automatic Free downgrade", async ({ page, request }) => {
  const mockURL = "http://127.0.0.1:4922/subscription/test/ui";
  await request.post(mockURL, { data: { provider: "stripe", oldAmount: 1999, newAmount: 0, targetAutomatic: true } });
  await page.goto("/billing");
  await page.getByRole("link", { name: "Change plan", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Change plan", exact: true });
  await expect(dialog.getByRole("radio", { name: /Immediately/ })).toHaveCount(0);
  await expect(dialog.getByRole("radio", { name: /At the next billing period/ })).toBeChecked();
  await dialog.getByRole("button", { name: "Review with Stripe" }).click();
  await expect(page).toHaveURL(/checkout.stripe.com/);
  expect((await (await request.get(mockURL)).json()).lastTiming).toBe("next_period");
});

test("Plus can buy a top-up when the backend marks it eligible", async ({ page, request }) => {
  const mockURL = "http://127.0.0.1:4922/subscription/test/ui";
  await request.post(mockURL, { data: { provider: "stripe", oldAmount: 1999, newAmount: 0, topupEligible: true } });
  await page.goto("/billing");
  await page.getByRole("button", { name: "Buy", exact: true }).click();
  await expect(page).toHaveURL(/checkout.stripe.com/);
  expect((await (await request.get(mockURL)).json()).lastTopupId).toBe("pack");
});
