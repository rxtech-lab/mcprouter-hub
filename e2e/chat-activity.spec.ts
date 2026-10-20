import { expect, test } from "@playwright/test";

test("tool calls stay collapsed across reasoning and steps, while answers separate groups", async ({ page }) => {
  await page.route("**/api/free-chat", async (route) => {
    const events: unknown[] = [{ type: "start", messageId: "grouped-reply" }];
    for (let index = 0; index < 4; index++) {
      events.push(
        { type: "start-step" },
        { type: "reasoning-start", id: `reason-${index}` },
        { type: "reasoning-delta", id: `reason-${index}`, delta: "Need another lookup" },
        { type: "reasoning-end", id: `reason-${index}` },
        { type: "tool-input-available", toolCallId: `call-${index}`, toolName: index === 0 ? "search_tools" : "lookup", input: { query: "weather" }, dynamic: index !== 0 },
        { type: "tool-output-available", toolCallId: `call-${index}`, output: { tools: [], result: "ok" } },
        { type: "finish-step" },
      );
    }
    events.push(
      { type: "text-start", id: "answer" },
      { type: "text-delta", id: "answer", delta: "The first results are ready." },
      { type: "text-end", id: "answer" },
      { type: "start-step" },
      { type: "tool-input-available", toolCallId: "last", toolName: "lookup", input: {}, dynamic: true },
      { type: "tool-output-available", toolCallId: "last", output: { result: "ok" } },
      { type: "finish-step" },
      { type: "finish" },
    );
    await route.fulfill({ contentType: "text/event-stream", headers: { "x-vercel-ai-ui-message-stream": "v1" }, body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n" });
  });
  await page.goto("/");
  const chat = page.getByTestId("hero-chat");
  await chat.getByRole("textbox", { name: "Message", exact: true }).fill("Check the weather");
  await chat.getByRole("button", { name: "Send", exact: true }).click();
  const groups = chat.getByTestId("tool-activity");
  await expect(groups).toHaveCount(2);
  await expect(groups.first()).not.toHaveAttribute("open");
  await expect(groups.first().locator("summary").first()).toContainText("Used 3 tools");
  await groups.first().locator("summary").first().click();
  await expect(groups.first().getByTestId("tool-search")).toBeVisible();
  await expect(groups.first().getByTestId("tool-call")).toHaveCount(3);
  await expect(chat).toContainText("The first results are ready.");
});
