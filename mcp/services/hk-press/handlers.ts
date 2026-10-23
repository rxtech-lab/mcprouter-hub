import type { RequestTransformer, ResponseTransformer } from "@/lib/mcp/types";
import { malformed, page, record } from "@/lib/mcp/spatial";

export const request: RequestTransformer = (built, input) => {
  const url = new URL(built.url);
  url.pathname = input.lang === "en" ? "/gia/rss/general_en.xml" : "/gia/rss/general_zh.xml";
  if (input.lang === "sc") {
    url.hostname = "sc.isd.gov.hk";
    url.pathname = `/TuniS/www.info.gov.hk${url.pathname}`;
  }
  return { ...built, url: url.toString() };
};

export const normalize: ResponseTransformer = (body, input) => {
  if (!record(body) || !record(body.rss) || !record(body.rss.channel)) malformed("Government RSS");
  const channel = body.rss.channel;
  if (typeof channel.title !== "string" || typeof channel.link !== "string") malformed("Government RSS");
  const items = channel.item === undefined ? [] : Array.isArray(channel.item) ? channel.item : [channel.item];
  const rows = items.map((item) => {
    if (!record(item) || typeof item.title !== "string" || typeof item.link !== "string" ||
      !/^https?:\/\//.test(item.link) || typeof item.pubDate !== "string" || !Number.isFinite(Date.parse(item.pubDate)) ||
      (item.description !== undefined && typeof item.description !== "string")) malformed("Government RSS item");
    const text = String(item.description ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return { title: item.title, link: item.link, publishedAt: item.pubDate,
      summary: text.slice(0, 2000), summaryTruncated: text.length > 2000 };
  });
  const term = String(input.search ?? "").toLowerCase();
  const filtered = rows.filter((row) => `${row.title} ${row.summary}`.toLowerCase().includes(term));
  const offset = Number(input.offset);
  return { title: channel.title, language: input.lang, feedUrl: channel.link, total: filtered.length,
    ...page(filtered.slice(offset), offset, Number(input.limit)) };
};
