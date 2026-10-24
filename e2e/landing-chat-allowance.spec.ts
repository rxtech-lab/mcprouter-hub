import { expect, test } from "@playwright/test";

for (const mobile of [false, true]) {
  test(`signed-in landing chat shows member usage${mobile ? " on mobile" : ""}`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const chat = page.getByTestId("hero-chat");
    if (mobile) await chat.getByRole("button", { name: "Ask the agent", exact: true }).click();
    await expect(chat.getByTestId("chat-allowance")).toContainText("Chat allowance");
    await expect(chat.getByTestId("chat-allowance")).toContainText("MCP calls");
    await expect(chat.getByTestId("chat-allowance")).not.toContainText("Plan allowance");
    await expect(chat.getByTestId("chat-allowance")).toContainText("Premium MCP calls");
    await expect(chat.getByText(/free messages left today|Sign in for more|Sign in to view credits/)).toHaveCount(0);
    await expect(chat.getByRole("textbox", { name: "Message" })).toBeEnabled();
    await page.screenshot({ animations: "disabled", path: `/tmp/chat-allowance-${mobile ? "mobile" : "desktop"}.png` });
  });
}
