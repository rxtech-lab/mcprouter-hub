import { expect, test } from "@playwright/test";

for (const mode of ["desktop", "mobile", "unavailable", "invalid"] as const) {
  test(`agent map: ${mode}`, async ({ page }) => {
    if (mode === "mobile") await page.setViewportSize({ width: 390, height: 844 });
    // Exercise rendering without downloading Mapbox tiles during automation.
    await page.route("https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/**", (route) => mode === "unavailable" ? route.abort() : route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#191a1a"/><path d="M0 128H256M128 0V256" stroke="#303438" stroke-width="12"/></svg>' }));
    await page.route("**/api/free-chat", async (route) => {
      const input = {
        title: "Harbour crossing",
        pins: [{ label: "Central", latitude: 22.286, longitude: 114.158, description: "Central ferry pier" }, { label: "Tsim Sha Tsui", latitude: 22.294, longitude: 114.168 }],
        routes: [{ label: "Ferry route", coordinates: [{ latitude: 22.286, longitude: 114.158 }, { latitude: 22.29, longitude: 114.16 }, { latitude: 22.294, longitude: 114.168 }] }],
      };
      const events = [
        { type: "start", messageId: "map-reply" },
        { type: "tool-input-available", toolCallId: "map", toolName: "show_map", input: mode === "invalid" ? { ...input, pins: [], routes: [] } : input },
        { type: "tool-output-available", toolCallId: "map", output: { shown: true } },
        { type: "finish" },
      ];
      await route.fulfill({ contentType: "text/event-stream", headers: { "x-vercel-ai-ui-message-stream": "v1" }, body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n" });
    });
    await page.goto("/");
    const chat = page.getByTestId("hero-chat");
    if (mode === "mobile") await chat.getByRole("button", { name: "Ask the agent", exact: true }).click();
    await chat.getByRole("textbox", { name: "Message", exact: true }).fill("Show the ferry route and piers on a map");
    await chat.getByRole("button", { name: "Send", exact: true }).click();
    if (mode === "invalid") {
      await expect(chat.getByText("This map could not be displayed.", { exact: true })).toBeVisible();
      await expect(chat.getByTestId("agent-map")).toHaveCount(0);
      return;
    }
    const map = chat.getByTestId("agent-map");
    await expect(map).toBeVisible();
    await expect.poll(() => map.getByRole("img", { name: "Mapbox", exact: true }).first().evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(map.getByRole("link", { name: "© Mapbox", exact: true })).toBeVisible();
    await expect(map.locator("image").first()).toHaveAttribute("href", /api\.mapbox\.com\/styles\/v1\/mapbox\/dark-v11\/tiles\/256\//);
    await expect(map.getByTestId("map-route")).toHaveCount(1);
    await expect(map.getByRole("link", { name: "© OpenStreetMap contributors" })).toBeVisible();
    const pin = map.getByRole("button", { name: "1. Central", exact: true });
    await pin.last().click();
    await expect(map).toContainText("Central ferry pier");
    await expect(map.getByRole("link", { name: "Open in OpenStreetMap" })).toHaveAttribute("href", /mlat=22.286&mlon=114.158/);
    const routeLine = map.getByTestId("map-route").locator("polyline").last();
    const before = await routeLine.getAttribute("points");
    await map.getByRole("button", { name: "Zoom in", exact: true }).click();
    expect(await routeLine.getAttribute("points")).not.toBe(before);
    await map.getByRole("button", { name: "Fit map", exact: true }).click();
    if (mode === "unavailable") await expect(map.getByRole("status")).toContainText("Map tiles are unavailable");
    await map.getByRole("button", { name: "Expand map" }).click();
    const dialog = page.getByRole("dialog", { name: "Harbour crossing" });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((element) => element.tagName)).toBe("DIALOG");
    await expect(dialog.getByTestId("map-route")).toHaveCount(1);
    await page.screenshot({ path: `test-results/agent-map-${mode}.png`, animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(map.getByRole("button", { name: "Expand map" })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
