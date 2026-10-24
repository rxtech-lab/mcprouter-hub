import { expect, test } from "@playwright/test";

for (const mobile of [false, true]) {
  test(`service chat opens inline and sends only the service id (${mobile ? "mobile" : "desktop"})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/provider-chat", async (route) => {
      const body = route.request().postDataJSON();
      expect(body.serviceId).toBe("td-street-parking");
      expect(body.apiId).toBeUndefined();
      expect(body.messages.at(-1).parts).toEqual([{ type: "text", text: "Use this tool: parking_meter_vacancy" }]);
      await route.fulfill({ status: 200, contentType: "text/event-stream", headers: { "x-vercel-ai-ui-message-stream": "v1" }, body: 'data: {"type":"start","messageId":"answer"}\n\ndata: {"type":"finish"}\n\ndata: [DONE]\n\n' });
    });
    await page.goto("/sources/td-street-parking");
    await page.locator('a[href="/en/sources/td-street-parking?chat=1"]').click();
    await expect(page).toHaveURL("/en/sources/td-street-parking?chat=1");
    const dialog = page.getByRole("dialog", { name: "On-street Parking" });
    await expect(dialog).toBeVisible();
    if (mobile) await dialog.getByRole("button", { name: "Details & tools" }).click();
    await expect(dialog.getByRole("button", { name: "parking_meter_vacancy", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "hko_current_weather", exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "show_ui", exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "parking_meter_vacancy", exact: true }).click();
    await expect(dialog.getByTestId("tool-request-message")).toBeVisible();
    await expect(dialog.getByTestId("tool-request-message")).toContainText("parking meter vacancy");
    await expect(dialog.getByTestId("tool-request-message").locator("code")).toHaveText("parking_meter_vacancy");
    await expect(dialog.getByText("Use this tool: parking_meter_vacancy", { exact: true })).toHaveCount(0);
    await page.screenshot({ animations: "disabled", path: `/tmp/mcprouter-tool-message-${mobile ? "mobile" : "desktop"}.png` });
    await expect(dialog.getByTestId("chat-allowance").getByRole("link", { name: /^Chat allowance:/ })).toHaveAttribute("href", "/billing");
    await dialog.getByRole("button", { name: "Full screen", exact: true }).click();
    await expect(page).toHaveURL(/fullscreen=1/);
    await dialog.getByRole("button", { name: "Minimize", exact: true }).click();
    await expect(dialog.getByTestId("tool-request-message")).toBeVisible();
    await expect(dialog.getByTestId("tool-request-message")).toContainText("parking meter vacancy");
    await expect(dialog.getByTestId("tool-request-message").locator("code")).toHaveText("parking_meter_vacancy");
    await expect(dialog.getByText("Use this tool: parking_meter_vacancy", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page).toHaveURL("/en/sources/td-street-parking");
    await expect(dialog).not.toBeVisible();
  });
}
