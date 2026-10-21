import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextFetchEvent } from "next/server";
import { localizedHref, splitLocalePath } from "@/lib/i18n/routing";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-site-path": "/login" }) }));
vi.mock("@/lib/i18n/server", () => ({ getLocale: async () => "en" }));
vi.mock("@/lib/auth", () => ({ proxy: vi.fn(async () => null) }));
import { canonicalQuery, indexableQuery, seoMetadata, seoOrigin } from "@/lib/seo";
import proxy from "@/proxy";

afterEach(() => vi.unstubAllEnvs());

describe("public SEO routing", () => {
  it("localizes public links without changing protocol, account or already localized URLs", () => {
    expect(localizedHref("/sources/hk-bus?chat=1#tools", "zh-HK")).toBe("/zh-HK/sources/hk-bus?chat=1#tools");
    expect(localizedHref("/#pricing", "en")).toBe("/en#pricing");
    for (const href of ["/api/mcp/streamable", "/keys", "/login", "https://rxlab.app", "//rxlab.app", "/en/sources"]) {
      expect(localizedHref(href, "zh-CN")).toBe(href);
    }
    expect(splitLocalePath("/zh-HK")).toEqual({ locale: "zh-HK", pathname: "/" });
  });

  it("takes locale and canonical path from the URL and overwrites forged request headers", async () => {
    const response = await proxy(new NextRequest("https://mcprouter.app/zh-HK/sources/hko-weather?chat=1", {
      headers: { "x-site-locale": "zh-CN", "x-site-path": "/login", "x-site-query": "q=forged" },
    }), {} as NextFetchEvent);
    expect(response?.headers.get("x-middleware-rewrite")).toBe("https://mcprouter.app/sources/hko-weather?chat=1");
    expect(response?.headers.get("x-middleware-request-x-site-locale")).toBe("zh-HK");
    expect(response?.headers.get("x-middleware-request-x-site-path")).toBe("/sources/hko-weather");
    expect(response?.headers.get("x-middleware-request-x-site-query")).toBe("chat=1");
    expect(response?.headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
  });

  it("retains list pagination but removes dialog and tracking state", () => {
    expect(canonicalQuery("/sources/apis", new URLSearchParams("page=2&chat=1&fullscreen=1&utm_source=test"))).toBe("?page=2");
    expect(canonicalQuery("/sources/providers/hko", new URLSearchParams("page=3"))).toBe("?page=3");
    expect(canonicalQuery("/sources/hk-bus", new URLSearchParams("page=3&chat=1"))).toBe("");
    for (const page of ["1", "0", "-1", "NaN", "1e5", "99999999999999999"]) {
      expect(canonicalQuery("/sources/apis", new URLSearchParams({ page }))).toBe("");
    }
  });

  it("preserves the listen origin for self-hosted locale rewrites", async () => {
    vi.stubEnv("__NEXT_NO_MIDDLEWARE_URL_NORMALIZE", "true"); // skipProxyUrlNormalize in next.config.ts
    const response = await proxy(new NextRequest("http://127.0.0.1:3211/zh-CN/guides/cursor"), {} as NextFetchEvent);
    expect(response?.headers.get("x-middleware-rewrite")).toBe("http://127.0.0.1:3211/guides/cursor");
    expect(response?.headers.get("x-middleware-request-x-site-locale")).toBe("zh-CN");
  });

  it("excludes search and filter variants from the index, without excluding ordinary pagination", () => {
    for (const query of ["q=weather", "status=coming-soon", "category=weather", "kind=files", "api=1"]) expect(indexableQuery(new URLSearchParams(query))).toBe(false);
    expect(indexableQuery(new URLSearchParams("page=2&chat=1"))).toBe(true);
  });

  it("includes the homepage brand without relying on the root layout title template", async () => {
    const metadata = await seoMetadata("MCP tools for everyone", "Connect to data and services", "/");
    expect(metadata.title).toEqual({ absolute: "McpRouter · MCP tools for everyone" });
    expect(metadata.openGraph?.title).toBe("McpRouter · MCP tools for everyone");
    expect(metadata.twitter?.title).toBe("McpRouter · MCP tools for everyone");
  });

  it("defaults to the public production origin and noindexes account pages", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(seoOrigin()).toBe("https://mcprouter.app");
    const metadata = await seoMetadata("Login", "Sign in");
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates).toBeUndefined();
  });
});
