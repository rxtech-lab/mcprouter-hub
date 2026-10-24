import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db, newsContent } from "@/db";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";

const service = services.find((s) => s.id === "unified-news")!;
function call(name: string, input: Record<string, unknown> = {}) {
  return executeTool(service, service.tools.find((t) => t.name === name)!, input);
}
afterEach(() => vi.unstubAllEnvs());

describe("Unified news contract", () => {
  it("registers news, search and scrape tools globally under all three upstream API entries", () => {
    expect(service.region).toBe("global");
    expect(service.apis).toEqual(["API-3820", "API-3821", "API-3822"]);
    expect(service.tools.map((t) => t.name)).toEqual(["list_top_news", "get_news_detail", "scrape_website", "search_news"]);
  });
  it("rejects unbounded counts before credentials or network", async () => {
    vi.stubEnv("RAPIDAPI_KEY", "");
    for (const x of [0, -1, 51, 1.5, "2", null]) await expect(call("list_top_news", { x })).rejects.toThrow();
  });
  it("rejects invalid search queries, limits and private scrape URLs", async () => {
    vi.stubEnv("FIRECRAWL_API_KEY", "");
    for (const query of ["", "  ", "x".repeat(501)]) await expect(call("search_news", { query })).rejects.toThrow();
    for (const limit of [0, 51, 1.5, "2"]) await expect(call("search_news", { query: "news", limit })).rejects.toThrow();
    for (const url of ["file:///etc/passwd", "https://localhost/path", "https://127.0.0.1/path", "http://[::1]/", "https://example.local/path", "https://user:pass@example.com/path", "https://example.com:8080/path"]) {
      await expect(call("scrape_website", { url })).rejects.toThrow();
    }
  });
  it("rejects malformed IDs and foreign or credential-bearing Reuters references before fetching", async () => {
    vi.stubEnv("RAPIDAPI_KEY", "");
    const id = (url: string) => `reuters:${Buffer.from(url).toString("base64url")}`;
    for (const value of ["other:123", "trade-bloom:../foo", "reuters:a", "reuters:***", "", "hacker-news:0", "hacker-news:-1", "hacker-news:01", "hacker-news:9007199254740992", "hacker-news:../101",
      id("http://www.reuters.com/world/test/"), id("https://www.reuters.com.evil.example/world/test/"),
      id("https://user:password@www.reuters.com/world/test/"), id("https://127.0.0.1/private"),
      id("https://www.reuters.com/")]) {
      await expect(call("get_news_detail", { id: value })).rejects.toThrow();
    }
  });
});

// Run against the Postman simulation; this suite uses the real runtime and HTTP fetcher.
describe.skipIf(!process.env.UNIFIED_NEWS_SIM_URL)("Unified news over real HTTP", () => {
  beforeAll(async () => { await migrate(db, { migrationsFolder: "db/migrations" }); });
  function configure(key = "simulation-ok") {
    vi.stubEnv("RAPIDAPI_KEY", key);
    vi.stubEnv("TRADE_BLOOM_BASE_URL", `${process.env.UNIFIED_NEWS_SIM_URL}/trade-bloom`);
    vi.stubEnv("REUTERS_BASE_URL", `${process.env.UNIFIED_NEWS_SIM_URL}/reuters`);
    vi.stubEnv("HACKER_NEWS_BASE_URL", `${process.env.UNIFIED_NEWS_SIM_URL}/hacker-news${key === "simulation-both-error" ? "/error" : ""}`);
    vi.stubEnv("FIRECRAWL_BASE_URL", `${process.env.UNIFIED_NEWS_SIM_URL}/firecrawl/v2`);
    vi.stubEnv("FIRECRAWL_API_KEY", "simulation-firecrawl");
    vi.stubEnv("AI_GATEWAY_API_KEY", "simulation-gateway");
    vi.stubEnv("NEWS_DECISION_BASE_URL", `${process.env.UNIFIED_NEWS_SIM_URL}/decision`);
  }
  async function scrapeCount() {
    return (await (await fetch(`${process.env.UNIFIED_NEWS_SIM_URL}/firecrawl/stats`)).json()).scrapes as number;
  }
  it("scrapes missing HN body after a decision and reuses content saved in the database", async () => {
    configure();
    await db.delete(newsContent);
    const before = await scrapeCount();
    const result = (await call("get_news_detail", { id: "hacker-news:101" })).data;
    expect(result).toMatchObject({ article: { id: 101 }, content: { source: "firecrawl", cached: false, markdown: expect.stringContaining("Full article body") } });
    expect(await db.select().from(newsContent)).toMatchObject([{ url: "https://example.com/story", markdown: expect.stringContaining("Full article body") }]);
    const { scrapeArticle } = await import("@/lib/news/firecrawl");
    const { handlerContext } = await import("@/lib/mcp/runtime");
    const saved = await scrapeArticle("https://example.com/story", handlerContext(service, service.tools[1]));
    expect(saved.cached).toBe(true);
    expect(await scrapeCount()).toBe(before + 1);
  });
  it("keeps an existing Reuters body and an HN self-post without scraping", async () => {
    configure();
    const before = await scrapeCount();
    const id = `reuters:${Buffer.from("https://www.reuters.com/world/example-1/").toString("base64url")}`;
    expect((await call("get_news_detail", { id })).data).not.toHaveProperty("content");
    expect((await call("get_news_detail", { id: "hacker-news:102" })).data).toMatchObject({ article: { text: "<p>Example question</p>" } });
    expect(await scrapeCount()).toBe(before);
  });
  it("fails without scraping when the decision model fails", async () => {
    configure();
    vi.stubEnv("NEWS_DECISION_BASE_URL", `${process.env.UNIFIED_NEWS_SIM_URL}/decision/outage`);
    const before = await scrapeCount();
    const id = `reuters:${Buffer.from("https://www.reuters.com/world/example-2/").toString("base64url")}`;
    await expect(call("get_news_detail", { id })).rejects.toThrow("decision failed");
    expect(await scrapeCount()).toBe(before);
  });
  it("searches news and supports stateless details from search IDs", async () => {
    configure();
    const result = (await call("search_news", { query: "technology", limit: 2 })).data as { news: { id: string }[] };
    expect(result).toMatchObject({ returned: 1, news: [{ provider: "firecrawl", title: "Example news" }] });
    expect((await call("get_news_detail", { id: result.news[0].id })).data).toMatchObject({ provider: "firecrawl", content: { url: "https://example.com/search-story" } });
  });
  it("reuses a saved scrape without Firecrawl credentials and coalesces concurrent requests", async () => {
    configure();
    const before = await scrapeCount();
    await Promise.all(Array.from({ length: 3 }, () => call("scrape_website", { url: "https://example.com/concurrent" })));
    vi.stubEnv("FIRECRAWL_API_KEY", "");
    expect((await call("scrape_website", { url: "https://example.com/concurrent#fragment" })).data).toMatchObject({ cached: true });
    expect(await scrapeCount()).toBe(before + 1);
  });
  it.each(["rate-limit", "provider-error", "invalid-json", "blocked", "empty", "oversized"])("does not cache a failed scrape: %s", async (mode) => {
    configure();
    const url = `https://example.com/${mode}`;
    const before = await scrapeCount();
    for (let i = 0; i < 2; i++) {
      await expect(call("scrape_website", { url })).rejects.not.toThrow("secret-echo");
    }
    expect(await scrapeCount()).toBe(before + 2);
  });
  it("handles empty search, rate limits and malformed search responses", async () => {
    configure();
    expect((await call("search_news", { query: "empty" })).data).toMatchObject({ returned: 0, news: [] });
    await expect(call("search_news", { query: "rate limit" })).rejects.toMatchObject({ code: "upstream_http", status: 429 });
    await expect(call("search_news", { query: "malformed" })).rejects.toMatchObject({ code: "upstream_parse" });
  });
  it("requests x per source, deduplicates modules and preserves ranks while interleaving", async () => {
    configure();
    const result = (await call("list_top_news", { x: 2 })).data as { returned: number; partial: boolean; news: { id: string; provider: string }[] };
    expect(result.returned).toBe(6);
    expect(result.partial).toBe(false);
    expect(result.news.map((n) => n.provider)).toEqual(["trade-bloom", "reuters", "hacker-news", "trade-bloom", "reuters", "hacker-news"]);
    expect(new Set(result.news.map((n) => n.id)).size).toBe(6);
    expect(result.news[0].id).toBe("trade-bloom:TNF3BYKIP3IM00");
  });
  it("routes a Reuters detail without a preceding list or saved mapping", async () => {
    configure();
    const id = `reuters:${Buffer.from("https://www.reuters.com/world/example-1/").toString("base64url")}`;
    expect((await call("get_news_detail", { id })).data).toMatchObject({ id, provider: "reuters", article: { title: "Reuters example 1", content: "Example wire dispatch." } });
  });
  it("routes Trade Bloom detail to a matching bulletin using ids", async () => {
    configure();
    const id = "trade-bloom:TNF3BYKIP3IM00";
    expect((await call("get_news_detail", { id })).data).toMatchObject({
      id, provider: "trade-bloom", article: { internalID: "TNF3BYKIP3IM00", title: "Trade Bloom example 0", wordCount: 123 },
    });
  });
  it("rejects Trade Bloom bulletin provider access errors inside HTTP 200", async () => {
    configure("simulation-business-error");
    await expect(call("get_news_detail", { id: "trade-bloom:TNF3BYKIP3IM00" })).rejects.toMatchObject({ code: "upstream_http", status: 401 });
  });
  it.each([
    ["simulation-ok", "TNF3BYKIP3IM09", "upstream_http", 404],
    ["simulation-mismatch", "TNF3BYKIP3IM00", "upstream_http", 404],
    ["simulation-duplicate", "TNF3BYKIP3IM00", "upstream_parse", undefined],
    ["simulation-oversized", "TNF3BYKIP3IM00", "upstream_parse", undefined],
    ["simulation-malformed", "TNF3BYKIP3IM00", "upstream_parse", undefined],
  ])("rejects unavailable or invalid Trade Bloom bulletins: %s", async (mode, reference, code, status) => {
    configure(mode);
    await expect(call("get_news_detail", { id: `trade-bloom:${reference}` })).rejects.toMatchObject({ code, status });
  });
  it.each([
    ["simulation-http", "upstream_http", 429],
    ["simulation-json", "upstream_parse", null],
    ["simulation-malformed", "upstream_parse", null],
    ["simulation-business-error", "upstream_http", 401],
  ])("reports a partial result for %s without leaking upstream bodies", async (key, code, httpStatus) => {
    configure(String(key));
    const result = (await call("list_top_news", { x: 2 })).data;
    expect(result).toMatchObject({ partial: true, returned: 4, providers: [
      { provider: "trade-bloom", status: "error", code, httpStatus },
      { provider: "reuters", status: "ok", returned: 2 },
      { provider: "hacker-news", status: "ok", returned: 2 },
    ] });
    expect(JSON.stringify(result)).not.toContain("secret-echo");
  });
  it("distinguishes a successful empty feed from a failed source", async () => {
    configure("simulation-empty");
    expect((await call("list_top_news", { x: 2 })).data).toMatchObject({ partial: false, returned: 4,
      providers: [{ provider: "trade-bloom", status: "ok", returned: 0 }, { provider: "reuters", status: "ok", returned: 2 },
        { provider: "hacker-news", status: "ok", returned: 2 }] });
  });
  it("errors when all sources fail and redacts error bodies", async () => {
    configure("simulation-both-error");
    await expect(call("list_top_news", { x: 2 })).rejects.toThrow("All news providers failed: trade-bloom: upstream_http (429); reuters: upstream_http (503); hacker-news: upstream_http (503)");
  });
  it("preserves upstream detail not-found status", async () => {
    configure();
    const id = `reuters:${Buffer.from("https://www.reuters.com/world/missing/").toString("base64url")}`;
    await expect(call("get_news_detail", { id })).rejects.toMatchObject({ code: "upstream_http", status: 404 });
  });
  it("returns Hacker News without RapidAPI credentials and uses the default count", async () => {
    configure("");
    expect((await call("list_top_news")).data).toMatchObject({ requestedPerProvider: 10, partial: true,
      returned: 3, providers: [
        { provider: "trade-bloom", status: "error", code: "configuration_error" },
        { provider: "reuters", status: "error", code: "configuration_error" },
        { provider: "hacker-news", status: "ok", returned: 3 },
      ] });
  });
  it("skips missing, deleted, dead and non-story items while preserving candidate rank", async () => {
    configure();
    const data = (await call("list_top_news", { x: 10 })).data as { news: { id: string; url: string; summary: string | null }[] };
    const stories = data.news.filter((n) => n.id.startsWith("hacker-news:"));
    expect(stories.map((n) => n.id)).toEqual(["hacker-news:101", "hacker-news:102", "hacker-news:106"]);
    expect(stories[1]).toMatchObject({ url: "https://news.ycombinator.com/item?id=102", summary: "<p>Example question</p>" });
    expect(stories[2].url).toBe("https://news.ycombinator.com/item?id=106");
  });
  it("routes stateless Hacker News details without credentials and preserves metadata", async () => {
    configure("");
    expect((await call("get_news_detail", { id: "hacker-news:101" })).data).toMatchObject({
      id: "hacker-news:101", provider: "hacker-news", article: { id: 101, score: 42, kids: [201] },
    });
  });
  it.each([103, 104, 105, 999])("reports unavailable Hacker News item %s", async (id) => {
    configure();
    await expect(call("get_news_detail", { id: `hacker-news:${id}` })).rejects.toMatchObject({ code: "upstream_http", status: 404 });
  });
  it("rejects oversized Hacker News details", async () => {
    configure();
    await expect(call("get_news_detail", { id: "hacker-news:107" })).rejects.toThrow("90 KB");
  });
  it.each(["error", "json", "malformed", "bad-item"])("reports Hacker News %s as a source failure", async (mode) => {
    configure();
    vi.stubEnv("HACKER_NEWS_BASE_URL", `${process.env.UNIFIED_NEWS_SIM_URL}/hacker-news/${mode}`);
    const data = (await call("list_top_news", { x: 2 })).data;
    expect(data).toMatchObject({ partial: true, returned: 4, providers: [
      { provider: "trade-bloom", status: "ok" }, { provider: "reuters", status: "ok" },
      { provider: "hacker-news", status: "error", code: mode === "error" ? "upstream_http" : "upstream_parse" },
    ] });
    expect(JSON.stringify(data)).not.toContain("secret-echo");
  });
  it("accepts an empty Hacker News feed", async () => {
    configure();
    vi.stubEnv("HACKER_NEWS_BASE_URL", `${process.env.UNIFIED_NEWS_SIM_URL}/hacker-news/empty`);
    expect((await call("list_top_news", { x: 2 })).data).toMatchObject({ partial: false, returned: 4,
      providers: [{ provider: "trade-bloom", status: "ok" }, { provider: "reuters", status: "ok" },
        { provider: "hacker-news", status: "ok", returned: 0 }] });
  });
});
