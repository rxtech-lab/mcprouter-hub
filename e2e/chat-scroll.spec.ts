import { expect, test } from "@playwright/test";

for (const surface of ["landing", "service"] as const) {
  for (const mobile of [false, true]) {
    test(`new questions scroll to the top: ${surface} ${mobile ? "mobile" : "desktop"}`, async ({ page }) => {
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      let requests = 0;
      let releaseReply = () => {};
      const pendingReply = new Promise<void>((resolve) => { releaseReply = resolve; });
      await page.route(surface === "landing" ? "**/api/free-chat" : "**/api/provider-chat", async (route) => {
        const index = ++requests;
        if (index === 2) await pendingReply;
        const text = index === 1 ? "Short reply." : "A long answer with more details.\n\n".repeat(60);
        const events = [
          { type: "start", messageId: `reply-${index}` },
          { type: "text-start", id: "text" },
          { type: "text-delta", id: "text", delta: text },
          { type: "text-end", id: "text" },
          { type: "finish" },
        ];
        await route.fulfill({ contentType: "text/event-stream", headers: { "x-vercel-ai-ui-message-stream": "v1" }, body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n" });
      });
      await page.goto(surface === "landing" ? "/" : "/sources/td-street-parking?chat=1");
      const chat = surface === "landing" ? page.getByTestId("hero-chat") : page.getByRole("dialog", { name: "On-street Parking" });
      if (mobile) await chat.getByRole("button", { name: surface === "landing" ? "Ask the agent" : "Chat", exact: true }).click();
      const composer = chat.getByRole("textbox", { name: "Message", exact: true });
      const send = chat.getByRole("button", { name: "Send", exact: true });
      const question = chat.getByTestId("user-message").last();
      const topOffset = () => question.evaluate((element) => {
        let scroller = element.parentElement!;
        while (!/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement!;
        return element.getBoundingClientRect().top - scroller.getBoundingClientRect().top - parseFloat(getComputedStyle(scroller).paddingTop);
      });
      await composer.fill("First question");
      await send.click();
      await expect(chat.getByTestId("agent-message")).toContainText("Short reply.");
      await expect.poll(topOffset).toBeLessThan(2);
      await composer.fill("Follow-up question");
      await send.click();
      try {
        await expect(question).toHaveText("Follow-up question");
        await expect.poll(async () => Math.abs(await topOffset())).toBeLessThan(2);
      } finally {
        releaseReply();
      }
      await expect(chat.getByTestId("agent-message").last()).toContainText("A long answer");
      await expect(send).toBeVisible();
      await expect.poll(async () => Math.abs(await topOffset())).toBeLessThan(2);
      // The question stays in the normal flow: scrolling still reveals earlier turns.
      await question.evaluate((element) => {
        let scroller = element.parentElement!;
        while (!/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement!;
        scroller.scrollTo({ top: 0, behavior: "instant" });
      });
      await expect(chat.getByTestId("user-message").first()).toBeInViewport();
    });
  }
}
