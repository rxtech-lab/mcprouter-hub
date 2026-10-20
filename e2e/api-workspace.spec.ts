import { expect, test } from "@playwright/test";

test("API workspace resizes, minimizes and preserves the conversation", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/sources/apis?status=implemented&api=API-0014");
  const dialog = page.getByRole("dialog", { name: "MTR next train" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("code", { hasText: "mtr_next_train" })).toBeVisible();
  await expect(dialog.locator("code", { hasText: "hko_current_weather" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "show_ui", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "show_tool_ui", exact: true })).toBeVisible();
  const allowance = dialog.getByTestId("chat-allowance");
  await expect(allowance).toContainText(/free messages left today|Plan allowance/);
  await expect(allowance).toContainText(/credits|Credits/);
  const initialBounds = await dialog.boundingBox();
  expect(initialBounds!.width).toBeLessThan(page.viewportSize()!.width);
  await dialog.getByRole("button", { name: "Full screen", exact: true }).click();
  await expect(page).toHaveURL(/fullscreen=1/);
  await expect(dialog).toHaveCSS("width", `${page.viewportSize()!.width}px`);
  const separator = dialog.getByRole("separator");
  await separator.focus();
  await page.keyboard.press("ArrowRight");
  await expect(separator).toHaveAttribute("aria-valuenow", "42");
  const bounds = await separator.boundingBox();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + 30);
  await page.mouse.down();
  await page.mouse.move(700, bounds!.y + 30);
  await page.mouse.up();
  await expect.poll(async () => Number(await separator.getAttribute("aria-valuenow"))).toBeGreaterThan(42);

  await page.route("**/api/provider-chat", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.apiId).toBe("API-0014");
    expect(body.messages.at(-1).parts).toEqual([{ type: "text", text: "Use this tool: mtr_next_train" }]);
    const parts = [
      { type: "start", messageId: "answer" }, { type: "text-start", id: "text" },
      { type: "text-delta", id: "text", delta: "The next train is arriving soon." },
      { type: "text-end", id: "text" }, { type: "finish" },
    ];
    await route.fulfill({ status: 200, contentType: "text/event-stream", headers: { "x-vercel-ai-ui-message-stream": "v1" }, body: parts.map((part) => `data: ${JSON.stringify(part)}\n\n`).join("") + "data: [DONE]\n\n" });
  });
  await dialog.getByRole("button", { name: "mtr_next_train", exact: true }).click();
  await expect(dialog.getByTestId("tool-request-message").locator("code", { hasText: "mtr_next_train" })).toBeVisible();
  await expect(dialog.getByText("The next train is arriving soon.")).toBeVisible();
  const chat = dialog.getByRole("region", { name: "Chat with this API" });
  const bubble = dialog.getByTestId("user-message").locator(":scope > div");
  await expect(bubble).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(bubble).not.toHaveCSS("background-color", await chat.evaluate((element) => getComputedStyle(element).backgroundColor));
  await page.screenshot({ path: testInfo.outputPath("api-workspace-dark.png") });
  await dialog.getByRole("textbox", { name: "Message" }).fill("And the one after?");
  await dialog.getByRole("button", { name: "Minimize", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(page).not.toHaveURL(/fullscreen=1/);
  await expect(dialog.getByRole("button", { name: "Full screen", exact: true })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Message" })).toHaveValue("And the one after?");
  await expect(dialog.getByText("The next train is arriving soon.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL("/sources/apis?status=implemented");
});

test("API workspace uses mobile navigation and fullscreen deep links", async ({ page }) => {
  await page.route("**/api/provider-chat", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.messages.at(-1).parts).toEqual([{ type: "text", text: "Use this tool: mtr_next_train" }]);
    await route.fulfill({ status: 200, contentType: "text/event-stream", headers: { "x-vercel-ai-ui-message-stream": "v1" }, body: 'data: {"type":"start","messageId":"answer"}\n\ndata: {"type":"finish"}\n\ndata: [DONE]\n\n' });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sources/apis?api=API-0014&fullscreen=1");
  const dialog = page.getByRole("dialog", { name: "MTR next train" });
  await expect(dialog.getByRole("textbox", { name: "Message" })).toBeVisible();
  await dialog.getByRole("button", { name: "Details & tools" }).click();
  await expect(dialog.locator("code", { hasText: "mtr_next_train" })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Message" })).not.toBeVisible();
  await dialog.getByRole("button", { name: "mtr_next_train", exact: true }).click();
  await expect(dialog.getByTestId("tool-request-message").locator("code", { hasText: "mtr_next_train" })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Message" })).toBeFocused();
  await expect(dialog.getByRole("textbox", { name: "Message" })).toBeVisible();
  expect(await dialog.evaluate((element) => element.scrollWidth <= window.innerWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page).toHaveURL("/sources/apis");
});

test("unimplemented APIs keep their details without a chat composer", async ({ page }) => {
  await page.goto("/sources/apis?status=coming-soon");
  await page.getByTestId("api-list").getByRole("link").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Message" })).toHaveCount(0);
});
