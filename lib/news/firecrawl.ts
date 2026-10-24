import "server-only";
import { isIP } from "node:net";
import { eq } from "drizzle-orm";
import { db, newsContent } from "@/db";
import { UpstreamError } from "@/lib/mcp/fetcher";
import type { HandlerContext } from "@/lib/mcp/types";

export function publicArticleUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2900) throw new Error("Invalid public article URL");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Invalid public article URL"); }
  const host = url.hostname.toLowerCase();
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port ||
      !host.includes(".") || isIP(host.replace(/^\[|\]$/g, "")) ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)) {
    throw new Error("Expected a public HTTP(S) article URL without credentials or a custom port");
  }
  url.hash = "";
  return url.href;
}

export function newsSearchId(url: string) {
  return `firecrawl:${Buffer.from(publicArticleUrl(url)).toString("base64url")}`;
}

export function newsSearchUrl(id: string) {
  const reference = id.slice("firecrawl:".length);
  const url = publicArticleUrl(Buffer.from(reference, "base64url").toString("utf8"));
  if (Buffer.from(url).toString("base64url") !== reference) throw new Error("Invalid Firecrawl news id");
  return url;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function firecrawlRequest(path: "/search" | "/scrape", body: Record<string, unknown>, context: HandlerContext) {
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (!key) throw new Error("Configure FIRECRAWL_API_KEY on the server");
  let result: unknown;
  try {
    result = await context.fetchUpstream(`${(process.env.FIRECRAWL_BASE_URL || "https://api.firecrawl.dev/v2").replace(/\/$/, "")}${path}`, {
      method: "POST", headers: { Authorization: `Bearer ${key}` }, body, cacheTtl: 0,
    });
  } catch (error) {
    if (error instanceof UpstreamError) throw new UpstreamError(error.code, "Firecrawl request failed", error.status);
    throw new UpstreamError("upstream_network", "Firecrawl request failed");
  }
  if (!record(result) || typeof result.success !== "boolean") throw new UpstreamError("upstream_parse", "Invalid Firecrawl response");
  if (!result.success) throw new UpstreamError("upstream_http", "Firecrawl reported a provider error");
  if (!record(result.data)) throw new UpstreamError("upstream_parse", "Invalid Firecrawl data");
  return result.data;
}

export type ArticleContent = { url: string; markdown: string; source: "firecrawl"; cached: boolean; scrapedAt: string };

export async function cachedArticle(url: string): Promise<ArticleContent | null> {
  const [row] = await db.select().from(newsContent).where(eq(newsContent.url, url)).limit(1);
  return row ? { ...row, source: "firecrawl", cached: true, scrapedAt: row.scrapedAt.toISOString() } : null;
}

const pending = new Map<string, Promise<ArticleContent>>();

/** Persist only usable successful scrapes. Errors and empty results remain retryable by the caller. */
export async function scrapeArticle(value: unknown, context: HandlerContext): Promise<ArticleContent> {
  const url = publicArticleUrl(value);
  const cached = await cachedArticle(url);
  if (cached) return cached;
  const existing = pending.get(url);
  if (existing) return existing;
  const work = (async () => {
    const data = await firecrawlRequest("/scrape", {
      url, formats: ["markdown"], onlyMainContent: true, maxAge: 172800000, parsers: ["pdf"], timeout: 45000,
    }, context);
    const metadata = record(data.metadata) ? data.metadata : {};
    if (metadata.error || (typeof metadata.statusCode === "number" && metadata.statusCode >= 400)) {
      throw new UpstreamError("upstream_http", "Firecrawl could not retrieve the article", typeof metadata.statusCode === "number" ? metadata.statusCode : undefined);
    }
    if (typeof data.markdown !== "string" || !data.markdown.trim()) throw new UpstreamError("upstream_parse", "Firecrawl returned no article content");
    if (Buffer.byteLength(data.markdown) > 90_000) throw new UpstreamError("upstream_parse", "Firecrawl article exceeds the 90 KB detail limit");
    const scrapedAt = new Date();
    await db.insert(newsContent).values({ url, markdown: data.markdown, scrapedAt }).onConflictDoNothing();
    return { url, markdown: data.markdown, source: "firecrawl" as const, cached: false, scrapedAt: scrapedAt.toISOString() };
  })();
  pending.set(url, work);
  try { return await work; } finally { pending.delete(url); }
}
