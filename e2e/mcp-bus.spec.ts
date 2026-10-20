import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const script = execFileSync("bun", ["build", "./mcp/services/hk-bus/app.ts", "--target=browser", "--format=iife"], { encoding: "utf8" });
const styles = readFileSync("mcp/apps/styles.css", "utf8");

for (const mode of ["desktop", "mobile", "chinese", "expired", "empty", "namespaced", "refresh-failure"] as const) {
  test(`bus arrival board: ${mode}`, async ({ page }) => {
    const mobile = mode === "mobile";
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const now = Date.now();
    const data = mode === "empty" ? [] : [2, 22].map((minutes, index) => ({ route: "72", dir: "O", seq: 3, dest_en: "Causeway Bay (Moreton Terrace)", dest_tc: "銅鑼灣（摩頓台）", eta_seq: index + 1, eta: new Date(now + (mode === "expired" ? -30 : minutes) * 60000).toISOString(), rmk_en: "", data_timestamp: new Date(now).toISOString() }));
    const result = { structuredContent: { tool: mode === "namespaced" ? "mcprouter__bus" : "bus", input: { action: "citybus_eta", route: "72", stopId: "001001" }, data, meta: {} } };
    await page.setContent('<iframe title="Bus app" style="width:100%;height:780px;border:0"></iframe>');
    await page.evaluate(({ result, chinese, failure }) => {
      window.addEventListener("message", (event) => {
        const message = event.data;
        if (message.method === "ui/initialize") {
          event.source?.postMessage({ jsonrpc: "2.0", id: message.id, result: { hostCapabilities: { serverTools: {} }, hostContext: { theme: "dark", locale: chinese ? "zh-HK" : "en", toolInfo: { tool: { name: "bus" } } } } }, { targetOrigin: "*" });
        }
        if (message.method === "ui/notifications/initialized") event.source?.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: result }, { targetOrigin: "*" });
        if (message.method === "tools/call") event.source?.postMessage({ jsonrpc: "2.0", id: message.id, ...(failure ? { error: { code: -32000, message: "Offline" } } : { result }) }, { targetOrigin: "*" });
      });
    }, { result, chinese: mode === "chinese", failure: mode === "refresh-failure" });
    await page.locator("iframe").evaluate((element, html) => { (element as HTMLIFrameElement).srcdoc = html; }, `<html><head><style>${styles}</style></head><body><main id="app"></main><script>${script.replace(/<\/script/gi, "<\\/script")}</script></body></html>`);
    const app = page.frameLocator("iframe");
    await expect(app.locator(".bus-board")).toBeVisible();
    await expect(app.locator("table")).toHaveCount(0);
    if (mode === "empty") {
      await expect(app.getByText("No upcoming departures")).toBeVisible();
      return;
    }
    await expect(app.locator(".bus-arrival-card")).toHaveCount(1);
    await expect(app.locator(".bus-destination")).toContainText("銅鑼灣");
    if (mode === "expired") await expect(app.getByText("No upcoming departures")).toBeVisible();
    else await expect(app.locator(".bus-countdown")).toHaveText(mode === "chinese" ? "2 分鐘" : "2 min");
    if (mode === "refresh-failure") {
      await app.getByRole("button", { name: "Refresh", exact: true }).click();
      await expect(app.getByRole("status")).toContainText("Could not update arrivals");
      await expect(app.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
      return;
    }
    const details = app.getByRole("button", { name: mode === "chinese" ? "班次詳情" : "Timetable", exact: true });
    await details.click();
    const dialog = app.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("li")).toHaveCount(2);
    expect(await dialog.evaluate((element) => element.tagName)).toBe("DIALOG");
    await page.screenshot({ path: `test-results/bus-${mode}-dialog.png` });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(details).toBeFocused();
    const frame = page.frames()[1];
    expect(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/bus-${mode}.png` });
  });
}
