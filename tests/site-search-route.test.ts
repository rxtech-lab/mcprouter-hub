import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), quota: vi.fn(), cookies: vi.fn(), decide: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/i18n/server", async () => {
  const { createTranslator } = await import("@/lib/i18n/translate");
  return { getT: async () => createTranslator("en", {}) };
});
vi.mock("@/lib/free-chat", async (original) => ({ ...await original<typeof import("@/lib/free-chat")>(), consumeFreeMessage: mocks.quota }));
vi.mock("@/lib/site-search/decision", () => ({ decideSearchIntent: mocks.decide }));
import { GET, POST } from "@/app/api/search/route";
afterEach(() => vi.unstubAllEnvs());
const submit = (body: unknown) => POST(new Request("https://site.test/api/search", { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "member-1" });
  mocks.quota.mockResolvedValue({ allowed: true });
  mocks.cookies.mockResolvedValue({ get: () => ({ value: "visitor-1" }), set: vi.fn() });
  mocks.decide.mockResolvedValue("chat");
});
it("GET text search never invokes AI or consumes allowance", async () => {
  const response = await GET(new Request("https://site.test/api/search?q=Setup%20guides&locale=en"));
  expect(await response.json()).toMatchObject({ intent: "search", results: [expect.objectContaining({ href: "/guides" })] });
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(mocks.decide).not.toHaveBeenCalled();
  expect(mocks.quota).not.toHaveBeenCalled();
});
it("returns an agent decision with a separate rate-limit namespace", async () => {
  expect(await (await submit({ query: "What's the weather?", locale: "en" })).json()).toMatchObject({ intent: "chat" });
  expect(mocks.quota.mock.calls[0][0].guest).toBe("guest:search-router:member-1");
  expect(mocks.quota.mock.calls[0][1]).toMatchObject({ dailyLimit: 60, ipDailyLimit: 240 });
});
it("fails open to text results when AI is unavailable or rate-limited", async () => {
  mocks.decide.mockRejectedValue(new Error("unavailable"));
  expect(await (await submit({ query: "Setup guides" })).json()).toMatchObject({ intent: "search", fallback: true });
  mocks.decide.mockClear(); mocks.quota.mockResolvedValue({ allowed: false });
  expect(await (await submit({ query: "weather" })).json()).toMatchObject({ intent: "search", fallback: true });
  expect(mocks.decide).not.toHaveBeenCalled();
});
it("rejects invalid and oversized input before calling a model", async () => {
  expect((await submit({ query: "" })).status).toBe(400);
  expect((await submit({ query: "x".repeat(2001) })).status).toBe(400);
  expect((await GET(new Request(`https://site.test/api/search?q=${"x".repeat(2001)}`))).status).toBe(400);
  expect(mocks.decide).not.toHaveBeenCalled();
});

it("does not call a model when guest chat is disabled", async () => {
  vi.stubEnv("FREE_CHAT_DAILY_LIMIT", "0");
  mocks.user.mockResolvedValue(null);
  expect(await (await submit({ query: "weather" })).json()).toMatchObject({ intent: "search", fallback: true });
  expect(mocks.decide).not.toHaveBeenCalled();
  expect(mocks.quota).not.toHaveBeenCalled();
});
it("keeps a guest's router counters separate from the shared chat allowance", async () => {
  mocks.user.mockResolvedValue(null);
  expect(await (await submit({ query: "Is tomorrow a public holiday?" })).json()).toMatchObject({ intent: "chat" });
  expect(mocks.quota.mock.calls[0][0].guest).toBe("guest:search-router:visitor-1");
});
