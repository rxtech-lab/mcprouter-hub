import { expect, test } from "@playwright/test";

for (const scenario of ["desktop", "mobile", "landing", "decline", "denied", "timeout", "unavailable", "stale"] as const) {
  test(`location consent: ${scenario}`, async ({ page, context }) => {
    if (scenario === "mobile") await page.setViewportSize({ width: 390, height: 844 });
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 22.28123, longitude: 114.16123, accuracy: 30 });
    await page.addInitScript((mode) => {
      Object.assign(window, { locationCalls: 0 });
      const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      if (mode === "unavailable") {
        Object.defineProperty(navigator, "geolocation", { value: undefined });
        return;
      }
      navigator.geolocation.getCurrentPosition = (success, failure, options) => {
        (window as unknown as { locationCalls: number }).locationCalls++;
        if (mode === "denied" || mode === "timeout") {
          failure?.({ code: mode === "denied" ? 1 : 3 } as GeolocationPositionError);
        } else if (mode === "stale") {
          Object.assign(window, { resolveLocation: () => success({ coords: { latitude: 22.28, longitude: 114.16, accuracy: 30 }, timestamp: Date.now() } as GeolocationPosition) });
        } else original(success, failure, options);
      };
    }, scenario);
    await page.route("https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/**", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#191a1a"/></svg>' }));
    const submissions: string[] = [];
    await page.route(scenario === "landing" ? "**/api/free-chat" : "**/api/provider-chat", async (route) => {
      const messages = route.request().postDataJSON().messages;
      submissions.push(messages.at(-1).parts[0].text);
      const events = submissions.length === 1 ? [
        { type: "start", messageId: "location-question" },
        { type: "tool-input-available", toolCallId: "location", toolName: "request_user_location", input: { reason: "Find parking near you." } },
        { type: "tool-output-available", toolCallId: "location", output: { awaitingUserLocation: true } },
        { type: "finish" },
      ] : [{ type: "start", messageId: "reply" }, { type: "finish" }];
      await route.fulfill({ contentType: "text/event-stream", headers: { "x-vercel-ai-ui-message-stream": "v1" }, body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n" });
    });
    await page.goto(scenario === "landing" ? "/" : "/sources/td-street-parking?chat=1");
    const chat = scenario === "landing" ? page.getByTestId("hero-chat") : page.getByRole("dialog", { name: "On-street Parking" });
    if (scenario === "mobile") await chat.getByRole("button", { name: "Chat", exact: true }).click();
    const composer = chat.getByRole("textbox", { name: "Message", exact: true });
    await composer.fill("Find parking near me");
    await chat.getByRole("button", { name: "Send", exact: true }).click();
    const review = chat.getByRole("button", { name: "Review location request", exact: true });
    await expect(review).toBeEnabled();
    expect(await page.evaluate(() => (window as unknown as { locationCalls: number }).locationCalls)).toBe(0);
    await review.click();
    const consent = page.getByRole("dialog", { name: "Use your location?", exact: true });
    await expect(consent).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { locationCalls: number }).locationCalls)).toBe(0);
    // Closing the dialog is not consent and keeps the request available.
    await page.keyboard.press("Escape");
    await expect(consent).not.toBeVisible();
    await review.click();
    if (scenario === "decline") {
      await consent.getByRole("button", { name: "Enter a place instead" }).click();
    } else {
      await consent.getByRole("button", { name: "Share location", exact: true }).click();
      if (["denied", "timeout", "unavailable"].includes(scenario)) {
        await expect(consent.getByRole("alert")).toBeVisible();
        expect(submissions).toHaveLength(1);
        await consent.getByRole("button", { name: "Enter a place instead" }).click();
      } else if (scenario === "stale") {
        await expect(consent.getByRole("status")).toHaveText("Getting your location…");
        await page.keyboard.press("Escape");
        await composer.fill("Use Central instead");
        await chat.getByRole("button", { name: "Send", exact: true }).click();
        await expect(review).not.toBeVisible();
        await page.evaluate(() => (window as unknown as { resolveLocation: () => void }).resolveLocation());
      }
    }
    await expect.poll(() => submissions.length).toBe(2);
    if (scenario === "desktop" || scenario === "mobile" || scenario === "landing") {
      expect(submissions[1]).toContain('"latitude":22.28123,"longitude":114.16123,"accuracyMeters":30');
      expect(submissions[1]).toContain('"capturedAt":');
      const location = chat.getByTestId("shared-location-message");
      await expect(location).toContainText("Location shared");
      await expect(location).toContainText("22.28123° N, 114.16123° E");
      await expect(location).toContainText("Accuracy: ±30 m");
      await expect(location.locator("time")).toHaveAttribute("datetime", /Z$/);
      await expect(location).not.toContainText("latitude");
      const map = location.getByTestId("agent-map-canvas");
      await expect(map).toBeVisible();
      await expect(map.locator("image").first()).toHaveAttribute("href", /api\.mapbox\.com\/styles\/v1\/mapbox\/dark-v11\/tiles\/256\//);
      await expect(map.getByRole("button", { name: "1. Location shared" })).toBeVisible();
      await expect(location.getByRole("link", { name: "Open in OpenStreetMap" })).toHaveAttribute("href", /mlat=22.28123&mlon=114.16123/);
      await expect(chat.getByRole("button", { name: "Answer sent", exact: true })).toBeDisabled();
    } else {
      expect(submissions[1]).not.toContain("latitude");
    }
    if (scenario === "decline") expect(await page.evaluate(() => (window as unknown as { locationCalls: number }).locationCalls)).toBe(0);
  });
}
