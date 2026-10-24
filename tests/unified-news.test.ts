import { afterEach, describe, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";

const service = services.find((s) => s.id === "unified-news")!;
function call(name: string, input: Record<string, unknown> = {}) {
  return executeTool(service, service.tools.find((t) => t.name === name)!, input);
}
afterEach(() => vi.unstubAllEnvs());

describe("Unified news contract", () => {
  it("registers two tools globally under both upstream API entries", () => {
    expect(service.region).toBe("global");
    expect(service.apis).toEqual(["API-3820", "API-3821"]);
    expect(service.tools.map((t) => t.name)).toEqual(["list_top_news", "get_news_detail"]);
  });
  it("rejects unbounded counts before credentials or network", async () => {
    vi.stubEnv("RAPIDAPI_KEY", "");
    for (const x of [0, -1, 51, 1.5, "2", null]) await expect(call("list_top_news", { x })).rejects.toThrow();
  });
  it("requires a server credential and supplies a default x", async () => {
    vi.stubEnv("RAPIDAPI_KEY", "");
    await expect(call("list_top_news")).rejects.toThrow("Configure RAPIDAPI_KEY");
  });
  it("rejects foreign, malformed and credential-bearing Reuters references before fetching", async () => {
    vi.stubEnv("RAPIDAPI_KEY", "");
    const id = (url: string) => `reuters:${Buffer.from(url).toString("base64url")}`;
    for (const value of ["other:123", "trade-bloom:../foo", "reuters:a", "reuters:***", "",
      id("http://www.reuters.com/world/test/"), id("https://www.reuters.com.evil.example/world/test/"),
      id("https://user:password@www.reuters.com/world/test/"), id("https://127.0.0.1/private"),
      id("https://www.reuters.com/")]) {
      await expect(call("get_news_detail", { id: value })).rejects.toThrow();
    }
  });
});

// Run against the Postman simulation; this suite uses the real runtime and HTTP fetcher.
describe.skipIf(!process.env.UNIFIED_NEWS_SIM_URL)("Unified news over real HTTP", () => {
  function configure(key = "simulation-ok") {
    vi.stubEnv("RAPIDAPI_KEY", key);
    vi.stubEnv("TRADE_BLOOM_BASE_URL", `${process.env.UNIFIED_NEWS_SIM_URL}/trade-bloom`);
    vi.stubEnv("REUTERS_BASE_URL", `${process.env.UNIFIED_NEWS_SIM_URL}/reuters`);
  }
  it("requests x per source, deduplicates modules and preserves ranks while interleaving", async () => {
    configure();
    const result = (await call("list_top_news", { x: 2 })).data as { returned: number; partial: boolean; news: { id: string; provider: string }[] };
    expect(result.returned).toBe(4);
    expect(result.partial).toBe(false);
    expect(result.news.map((n) => n.provider)).toEqual(["trade-bloom", "reuters", "trade-bloom", "reuters"]);
    expect(new Set(result.news.map((n) => n.id)).size).toBe(4);
    expect(result.news[0].id).toBe("trade-bloom:TNF3BYKIP3IM00");
  });
  it("routes a Reuters detail without a preceding list or saved mapping", async () => {
    configure();
    const id = `reuters:${Buffer.from("https://www.reuters.com/world/example-1/").toString("base64url")}`;
    expect((await call("get_news_detail", { id })).data).toMatchObject({ id, provider: "reuters", article: { title: "Reuters example 1", content: "Example wire dispatch." } });
  });
  it("routes Trade Bloom detail and rejects its observed HTTP-200 access-error envelope", async () => {
    configure();
    await expect(call("get_news_detail", { id: "trade-bloom:TNF3BYKIP3IM00" })).rejects.toMatchObject({ code: "upstream_http", status: 401 });
  });
  it.each([
    ["simulation-http", "upstream_http", 429],
    ["simulation-json", "upstream_parse", null],
    ["simulation-malformed", "upstream_parse", null],
    ["simulation-business-error", "upstream_http", 401],
  ])("reports a partial result for %s without leaking upstream bodies", async (key, code, httpStatus) => {
    configure(String(key));
    const result = (await call("list_top_news", { x: 2 })).data;
    expect(result).toMatchObject({ partial: true, returned: 2, providers: [
      { provider: "trade-bloom", status: "error", code, httpStatus },
      { provider: "reuters", status: "ok", returned: 2 },
    ] });
    expect(JSON.stringify(result)).not.toContain("secret-echo");
  });
  it("distinguishes a successful empty feed from a failed source", async () => {
    configure("simulation-empty");
    expect((await call("list_top_news", { x: 2 })).data).toMatchObject({ partial: false, returned: 2,
      providers: [{ provider: "trade-bloom", status: "ok", returned: 0 }, { provider: "reuters", status: "ok", returned: 2 }] });
  });
  it("errors when both sources fail and redacts error bodies", async () => {
    configure("simulation-both-error");
    await expect(call("list_top_news", { x: 2 })).rejects.toThrow("Both news providers failed: trade-bloom: upstream_http (429); reuters: upstream_http (503)");
  });
  it("preserves upstream detail not-found status", async () => {
    configure();
    const id = `reuters:${Buffer.from("https://www.reuters.com/world/missing/").toString("base64url")}`;
    await expect(call("get_news_detail", { id })).rejects.toMatchObject({ code: "upstream_http", status: 404 });
  });
});
