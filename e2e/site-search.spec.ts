import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Use the real server text search while keeping browser tests independent of paid AI calls.
  await page.route("**/api/search", async (route) => {
    const { query, locale } = route.request().postDataJSON();
    const response = await page.request.get(`/api/search?q=${encodeURIComponent(query)}&locale=${locale ?? "en"}`);
    await route.fulfill({ response });
  });
});

for (const mobile of [false, true]) {
  test(`public server search${mobile ? " on mobile" : ""}`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const header = page.locator("header").first();
    await expect(header.getByRole("link", { name: "Data sources", exact: true })).toHaveCount(0);
    await expect(header.locator("kbd")).toHaveCount(0);
    await header.getByRole("button", { name: "Search", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Search", exact: true });
    const input = dialog.getByRole("combobox");
    await expect(input).toBeFocused();
    await dialog.getByRole("button", { name: "Chat", exact: true }).click();
    await expect(dialog.getByRole("textbox", { name: "Message", exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Back to search", exact: true }).click();
    await expect(input).toBeFocused();
    await input.fill("Setup guides");
    await expect(page).toHaveURL(/search=Setup\+guides/);
    await expect(dialog.getByRole("option", { name: "Setup guides" })).toBeVisible();
    await input.press("ArrowDown");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/guides$/);
    await page.keyboard.press("Control+k");
    await input.fill("a unique query & value");
    await dialog.getByRole("link", { name: "Search APIs", exact: true }).click();
    await expect(page).toHaveURL(/\/sources\/apis\?q=a%20unique%20query%20%26%20value/);
    await page.keyboard.press("Control+k");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(page.locator("header").first().getByRole("button", { name: "Search", exact: true })).toBeFocused();
  });
}

test("chat recommendation waits for selection before opening multi-turn chat", async ({ page }) => {
  let decisions = 0;
  let chats = 0;
  await page.route("**/api/search", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    decisions++;
    const { query } = route.request().postDataJSON();
    await route.fulfill({ json: { intent: query.includes("?") ? "chat" : "search", results: [{ href: "/sources/td-carpark", key: "td-carpark", label: "Car Park Information and Vacancy" }] } });
  });
  await page.route("**/api/free-chat", async (route) => {
    chats++;
    const { messages } = route.request().postDataJSON();
    expect(messages.at(-1).role).toBe("user");
    if (chats === 2) expect(messages.filter((item: { role: string }) => item.role === "user")).toHaveLength(2);
    const text = chats === 1 ? "Here is the answer from the agent." : "Here is the follow-up answer.";
    const chunks = [{ type: "start", messageId: `reply-${chats}` }, { type: "text-start", id: "text" }, { type: "text-delta", id: "text", delta: text }, { type: "text-end", id: "text" }, { type: "finish", finishReason: "stop" }];
    await route.fulfill({ contentType: "text/event-stream", headers: { "x-vercel-ai-ui-message-stream": "v1" }, body: chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n" });
  });
  await page.goto("/?search=carpark&searchView=search");
  const dialog = page.getByRole("dialog", { name: "Search", exact: true });
  const input = dialog.getByRole("combobox");
  await expect(dialog.getByRole("option", { name: "Car Park Information and Vacancy" })).toBeVisible();
  expect(decisions).toBe(1);
  expect(chats).toBe(0);
  await input.fill("What is the weather now?");
  const recommendation = dialog.getByRole("option", { name: /Chat with the agent about this/ });
  await expect(recommendation).toBeVisible();
  await expect(recommendation).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByRole("combobox")).toBeVisible();
  expect(chats).toBe(0);
  await expect(page).toHaveURL(/search=What/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.screenshot({ path: "/tmp/mcprouter-chat-recommendation.png" });
  await input.press("Enter");
  await expect(dialog.getByText("Here is the answer from the agent.")).toBeVisible();
  await expect(page).toHaveURL(/search=&searchView=chat/);
  await expect(page).not.toHaveURL(/weather/);
  const composer = dialog.getByRole("textbox", { name: "Message", exact: true });
  await composer.fill("And tomorrow?");
  await composer.press("Enter");
  await expect(dialog.getByText("Here is the follow-up answer.")).toBeVisible();
  expect(decisions).toBe(2);
  expect(chats).toBe(2);
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("site-search-chat-messages") ?? "[]").length)).toBe(4);
  await page.reload();
  await expect(dialog.getByText("Here is the answer from the agent.")).toBeVisible();
  await expect(dialog.getByText("Here is the follow-up answer.")).toBeVisible();
  expect(chats).toBe(2);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.screenshot({ path: "/tmp/mcprouter-search-chat.png" });
  await dialog.getByRole("button", { name: "Back to search" }).click();
  await expect(dialog.getByRole("combobox")).toBeFocused();
  await dialog.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(dialog.getByText("Here is the follow-up answer.")).toBeVisible();
  expect(chats).toBe(2);
  await dialog.getByRole("button", { name: "Back to search", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Ask the agent", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Continue chat", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog.getByRole("combobox").fill("Another question?");
  await expect(recommendation).toBeVisible();
  expect(chats).toBe(2);
  await page.screenshot({ path: "/tmp/mcprouter-chat-recommendation-mobile.png" });
  await recommendation.click();
  await expect(dialog.getByRole("textbox", { name: "Message", exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/mcprouter-search-chat-mobile.png" });
  await expect(dialog.getByText("Here is the follow-up answer.")).toHaveCount(2);
  await dialog.getByRole("button", { name: "New chat", exact: true }).click();
  await expect(dialog.getByTestId("user-message")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("site-search-chat-messages"))).toBeNull();
  await page.reload();
  await expect(dialog.getByTestId("user-message")).toHaveCount(0);

});

test("an unavailable decision model keeps search usable", async ({ page }) => {
  await page.route("**/api/search", async (route) => route.request().method() === "POST"
    ? route.fulfill({ json: { intent: "search", results: [], fallback: true } }) : route.continue());
  await page.goto("/?search=weather");
  const dialog = page.getByRole("dialog", { name: "Search", exact: true });
  await dialog.getByRole("button", { name: "Search or ask", exact: true }).click();
  await expect(dialog.getByText("AI routing is unavailable. Showing text matches.")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Search APIs", exact: true })).toBeVisible();
});

test("search waits for one second of idle typing and cancels earlier queries", async ({ page }) => {
  const submitted: string[] = [];
  await page.route("**/api/search", async (route) => {
    submitted.push(route.request().postDataJSON().query);
    await route.fulfill({ json: { intent: "search", results: [] } });
  });
  await page.goto("/?search=");
  const input = page.getByRole("dialog", { name: "Search", exact: true }).getByRole("combobox");
  await input.fill("weather");
  await page.waitForTimeout(600);
  expect(submitted).toEqual([]);
  await input.fill("weather API");
  await page.waitForTimeout(600);
  expect(submitted).toEqual([]);
  await expect.poll(() => submitted).toEqual(["weather API"]);
});

test("text matches appear while AI routing is still pending", async ({ page }) => {
  let releaseDecision!: () => void;
  const pending = new Promise<void>((resolve) => { releaseDecision = resolve; });
  let started = false;
  await page.route("**/api/search", async (route) => {
    started = true;
    await pending;
    await route.fulfill({ json: { intent: "chat", results: [{ href: "/guides", key: "guides", label: "Setup guides" }] } });
  });
  await page.goto("/?search=Setup+guides");
  const dialog = page.getByRole("dialog", { name: "Search", exact: true });
  try {
    await expect.poll(() => started).toBe(true);
    await expect(dialog.getByRole("option", { name: "Setup guides", exact: true })).toBeVisible();
    await expect(dialog.getByRole("option", { name: /Chat with the agent about this/ })).toHaveCount(0);
  } finally { releaseDecision(); }
  await expect(dialog.getByRole("option", { name: /Chat with the agent about this/ })).toBeVisible();
  await expect(dialog.getByRole("option", { name: "Setup guides", exact: true })).toBeVisible();
});
