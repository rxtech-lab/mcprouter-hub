import { expect, test } from "@playwright/test";

for (const mobile of [false, true]) {
  test(`formatted replies and answer dialog (${mobile ? "mobile" : "desktop"})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    let requests = 0;
    await page.route("**/api/provider-chat", async (route) => {
      requests++;
      const first = requests === 1;
      if (!first) expect(route.request().postDataJSON().messages.at(-1).parts).toEqual([{ type: "text", text: "Central" }]);
      const events = first ? [
        { type: "start", messageId: "question" },
        { type: "text-start", id: "text" },
        { type: "text-delta", id: "text", delta: "**Parking search**\n\nChoose a district:\n\n- Street parking\n- Meter availability\n\n| District | Status |\n| --- | --- |\n| Central | Available |" },
        { type: "text-end", id: "text" },
        { type: "tool-input-available", toolCallId: "ask", toolName: "request_user_input", input: { question: "Which district should I check?", options: mobile ? [] : [{ label: "Central", description: "Hong Kong Island" }, { label: "Kowloon City" }] } },
        { type: "tool-output-available", toolCallId: "ask", output: { awaitingUserInput: true } },
        { type: "finish" },
      ] : [{ type: "start", messageId: "reply" }, { type: "finish" }];
      await route.fulfill({ contentType: "text/event-stream", headers: { "x-vercel-ai-ui-message-stream": "v1" }, body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n" });
    });
    await page.goto("/sources/td-street-parking?chat=1");
    const chat = page.getByRole("dialog", { name: "On-street Parking" });
    if (mobile) await chat.getByRole("button", { name: "Chat", exact: true }).click();
    await chat.getByRole("textbox", { name: "Message", exact: true }).fill("Find parking");
    await chat.getByRole("button", { name: "Send", exact: true }).click();
    const reply = chat.getByTestId("agent-message");
    await expect(reply.locator("strong")).toHaveText("Parking search");
    await expect(reply.locator("li")).toHaveCount(2);
    await expect(reply.getByRole("table")).toBeVisible();
    await reply.getByRole("button", { name: "Answer question", exact: true }).click();
    const answer = page.getByRole("dialog", { name: "Which district should I check?", exact: true });
    await expect(answer).toBeVisible();
    await answer.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(answer).not.toBeVisible();
    await reply.getByRole("button", { name: "Answer question", exact: true }).click();
    await expect(answer.getByRole("button", { name: "Send answer", exact: true })).toBeDisabled();
    if (mobile) await answer.getByLabel("Your answer", { exact: true }).fill("Central");
    else {
      await answer.getByLabel("Central", { exact: false }).check();
      await expect(answer.getByLabel("Or enter your own answer")).toHaveValue("Central");
    }
    await answer.getByRole("button", { name: "Send answer", exact: true }).click();
    await expect(answer).not.toBeVisible();
    await expect(chat.getByTestId("user-message").last()).toHaveText("Central");
    await expect(reply.getByRole("button", { name: "Answer sent", exact: true })).toBeDisabled();
    expect(requests).toBe(2);
  });
}
