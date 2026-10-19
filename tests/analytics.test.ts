import { afterEach, beforeEach, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  isSupported: vi.fn(async () => true),
  initializeAnalytics: vi.fn(() => ({ app: "test" })),
  logEvent: vi.fn(),
  initializeApp: vi.fn(() => ({ name: "mcprouter-analytics" })),
  getApps: vi.fn(() => []),
}));
vi.mock("firebase/app", () => sdk);
vi.mock("firebase/analytics", () => sdk);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  sdk.isSupported.mockResolvedValue(true);
  vi.stubGlobal("window", { location: { origin: "https://mcprouter.test", pathname: "/chat/private-id" } });
  vi.stubGlobal("document", { referrer: "https://auth.test/callback?token=secret" });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("initializes once and removes private URL data from page views and events", async () => {
  const { trackPageView, trackEvent } = await import("@/lib/analytics");
  trackPageView("/chat/private-id?token=secret#private");
  trackEvent("chat_message_sent", { chat_type: "signed_in" });
  await vi.waitFor(() => expect(sdk.logEvent).toHaveBeenCalledTimes(2));
  expect(sdk.initializeAnalytics).toHaveBeenCalledTimes(1);
  expect(sdk.initializeAnalytics.mock.calls[0]).toEqual([
    { name: "mcprouter-analytics" },
    expect.objectContaining({ config: expect.objectContaining({ send_page_view: false }) }),
  ]);
  expect(sdk.logEvent).toHaveBeenCalledWith(expect.anything(), "page_view", expect.objectContaining({
    page_path: "/chat/[id]", page_location: "https://mcprouter.test/chat/[id]", page_referrer: "https://auth.test",
  }));
  expect(JSON.stringify(sdk.logEvent.mock.calls)).not.toMatch(/private-id|secret|token=/);
});

it("does not initialize in unsupported browsers", async () => {
  sdk.isSupported.mockResolvedValue(false);
  const { trackEvent } = await import("@/lib/analytics");
  trackEvent("get_started");
  await vi.waitFor(() => expect(sdk.isSupported).toHaveBeenCalled());
  expect(sdk.initializeAnalytics).not.toHaveBeenCalled();
  expect(sdk.logEvent).not.toHaveBeenCalled();
});

it("distinguishes dashboard and landing chat submissions without collecting their content", async () => {
  const { trackChatMessage } = await import("@/lib/analytics");
  trackChatMessage("dashboard");
  vi.stubGlobal("window", { location: { origin: "https://mcprouter.test", pathname: "/" } });
  trackChatMessage("landing_page");
  await vi.waitFor(() => expect(sdk.logEvent).toHaveBeenCalledTimes(2));
  expect(sdk.logEvent).toHaveBeenNthCalledWith(1, expect.anything(), "chat_message_sent", expect.objectContaining({
    surface: "dashboard", chat_type: "signed_in", page_location: "https://mcprouter.test/chat/[id]",
  }));
  expect(sdk.logEvent).toHaveBeenNthCalledWith(2, expect.anything(), "chat_message_sent", expect.objectContaining({
    surface: "landing_page", chat_type: "guest", page_location: "https://mcprouter.test/",
  }));
  expect(JSON.stringify(sdk.logEvent.mock.calls)).not.toMatch(/private-id|secret|token=/);
});

it("tracks API keys tab visits while excluding other dashboard tabs", async () => {
  vi.stubGlobal("window", { location: { origin: "https://mcprouter.test", pathname: "/keys" } });
  const { trackFeatureView } = await import("@/lib/analytics");
  for (const path of ["/", "/dashboard", "/chat", "/keys/apps", "/keys/setup", "/keys/telegram", "/keys/whatsapp"]) {
    trackFeatureView(path);
  }
  trackFeatureView("/keys");
  await vi.waitFor(() => expect(sdk.logEvent).toHaveBeenCalledTimes(1));
  expect(sdk.logEvent).toHaveBeenCalledWith(expect.anything(), "api_keys_viewed", expect.objectContaining({
    surface: "dashboard", page_path: "/keys", page_location: "https://mcprouter.test/keys",
  }));
});

it("can be disabled and is safe during server rendering", async () => {
  vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "false");
  const { trackEvent, trackPageView } = await import("@/lib/analytics");
  trackEvent("get_started");
  vi.stubGlobal("window", undefined);
  trackPageView("/");
  trackEvent("get_started");
  await Promise.resolve();
  expect(sdk.initializeApp).not.toHaveBeenCalled();
  expect(sdk.logEvent).not.toHaveBeenCalled();
});
