import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
import { isPublicCacheRequest, PUBLIC_CACHE_CONTROL, PUBLIC_CACHE_EXCLUDED_HEADERS, publicCacheRules } from "@/lib/public-cache";

const { authProxy } = vi.hoisted(() => ({ authProxy: vi.fn() }));
vi.mock("@/lib/auth", () => ({ proxy: authProxy }));
import proxy from "@/proxy";

const event = {} as NextFetchEvent;
function request(path = "/sources", headers: Record<string, string> = {}, method = "GET") {
  return new NextRequest(`https://mcprouter.app${path}`, { headers, method });
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("PUBLIC_CDN_CACHE_ENABLED", "true");
  vi.stubEnv("DEV_BYPASS_AUTH", "false");
  authProxy.mockReset().mockImplementation(() => {
    const response = NextResponse.next();
    response.cookies.set("session-refresh", "test-only");
    return response;
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("public crawler caching", () => {
  it.each(["/", "/sources", "/sources/hko-weather"])("caches cookie-free HTML at %s without invoking auth", async (path) => {
    const response = await proxy(request(path), event);
    expect(authProxy).not.toHaveBeenCalled();
    expect(response?.headers.get("set-cookie")).toBeNull();
    expect(response?.headers.get("Cloudflare-CDN-Cache-Control")).toBe(PUBLIC_CACHE_CONTROL);
    expect(response?.headers.has("cache-control")).toBe(false);
  });

  it.each(PUBLIC_CACHE_EXCLUDED_HEADERS)("bypasses cache when %s is present, even empty", async (name) => {
    const req = request("/sources/apis?api=API-2426&page=50&status=coming-soon", { [name.toUpperCase()]: "" });
    expect(isPublicCacheRequest(req)).toBe(false);
    expect((await proxy(req, event))?.headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
  });

  it.each([
    "/sources/apis",
    "/sources/apis?api=API-2426&page=50&status=coming-soon",
    "/sources/apis?status=coming-soon&page=50&api=API-2426",
    "/sources/apis?api=API-2427&page=49",
    "/sources/apis?category=weather&kind=rest&page=2",
  ])("caches public catalogue variant %s without initializing a session", async (path) => {
    const response = await proxy(request(path), event);
    expect(authProxy).not.toHaveBeenCalled();
    expect(response?.headers.get("set-cookie")).toBeNull();
    expect(response?.headers.get("Cloudflare-CDN-Cache-Control")).toBe(PUBLIC_CACHE_CONTROL);
    // The middleware must not rewrite URLs or collapse query variants.
    expect(response?.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("keeps session refresh and its cookies for signed-in requests", async () => {
    const req = request("/", { cookie: "__Secure-authjs.session-token.0=chunk" });
    const response = await proxy(req, event);
    expect(authProxy).toHaveBeenCalledWith(req, event);
    expect(response?.headers.get("set-cookie")).toContain("session-refresh=");
    expect(response?.headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
  });

  it.each(["/dashboard", "/login", "/billing", "/api/session/properties", "/api/mcp/streamable", "/sources/new-private-page", "/sources/hko-weather/secret"])("does not treat %s as a public cache route", async (path) => {
    expect(isPublicCacheRequest(request(path))).toBe(false);
    const response = await proxy(request(path), event);
    expect(authProxy).toHaveBeenCalled();
    expect(response?.headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
  });

  it.each([
    "/?client=codex", "/sources?_rsc=test", "/sources?q=weather",
    "/sources?api=API-2426", "/sources/hko-weather?page=2",
    "/sources/apis?q=weather", "/sources/apis?api=API-2426&_rsc=test",
    "/sources/apis?unknown=value", "/sources/apis?%61pi=API-2426",
    "/sources/apis?API=API-2426", `/sources/apis?api=${"x".repeat(509)}`,
  ])("does not cache query variant %s", async (path) => {
    expect((await proxy(request(path), event))?.headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
  });

  it.each(["POST", "HEAD", "OPTIONS"])("does not cache %s requests", async (method) => {
    expect((await proxy(request("/sources", {}, method), event))?.headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
  });

  it.each(["http://mcprouter.app/sources", "https://preview.vercel.app/sources", "https://www.mcprouter.app/sources"])("does not cache another scheme or host: %s", (url) => {
    expect(isPublicCacheRequest(new NextRequest(url))).toBe(false);
  });

  it("uses the incoming public Host rather than Next's listen address", () => {
    expect(isPublicCacheRequest(new NextRequest("https://127.0.0.1:3217/sources", { headers: { host: "mcprouter.app" } }))).toBe(true);
    expect(isPublicCacheRequest(request("/sources", { host: "preview.vercel.app" }))).toBe(false);
  });

  it.each([undefined, "false"])("defaults to no-store before explicit activation (%s)", async (flag) => {
    vi.stubEnv("PUBLIC_CDN_CACHE_ENABLED", flag);
    expect((await proxy(request(), event))?.headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
  });

  it("never publishes the development bypass user to a shared cache", async () => {
    vi.stubEnv("DEV_BYPASS_AUTH", "true");
    expect((await proxy(request(), event))?.headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
  });

  it("keeps the edge cache rules aligned with request exclusions", () => {
    const [bypass, cache] = publicCacheRules();
    expect(bypass.action_parameters.cache).toBe(false);
    expect(cache.action_parameters).toEqual({ cache: true, edge_ttl: {
      mode: "respect_origin", status_code_ttl: [
        { status_code_range: { to: 199 }, value: -1 },
        { status_code_range: { from: 201 }, value: -1 },
      ],
    }, browser_ttl: { mode: "respect_origin" } });
    expect(cache.expression).toContain("not http.request.headers.truncated");
    expect(cache.expression).toContain('http.request.uri.path eq "/sources/apis"');
    expect(cache.expression).toContain('all(http.request.uri.args.names[*] in {"api" "page" "status" "category" "kind"})');
    expect(cache.expression).toContain("len(http.request.uri.query) le 512");
    for (const name of PUBLIC_CACHE_EXCLUDED_HEADERS) {
      expect(cache.expression).toContain(`not any(lower(http.request.headers.names[*])[*] eq "${name}")`);
    }
    expect(cache.expression.length).toBeLessThanOrEqual(4096);
  });
});
