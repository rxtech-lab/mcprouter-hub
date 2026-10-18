import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import { services } from "@/generated/registry";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { executeTool } from "@/lib/mcp/runtime";
import type { ServiceDefinition, ToolDefinition, ToolInput } from "@/lib/mcp/types";

/**
 * Runs every generated MCP tool against a stubbed upstream: checks the HTTP
 * request it sends (URL, method, body) and how it shapes the reply. Any request
 * the case didn't expect fails the test, so nothing reaches the network.
 */

type Case = {
  /** Test name; defaults to the tool name. */
  name?: string;
  tool: string;
  input: ToolInput;
  /** Expected upstream request. Omit for tools that never call out. */
  request?: { url: string; method?: "GET" | "POST"; body?: unknown };
  /** Upstream reply: objects are sent as JSON, strings as-is. */
  reply?: unknown;
  /** Replies to follow-up requests a transformer makes, by URL. */
  lookups?: Record<string, unknown>;
  /** Expected `data` of the tool result. */
  data?: unknown;
  /** Expected `meta` of the tool result (`source` is checked separately). */
  meta?: Record<string, unknown>;
  /** Expected cache TTL in seconds for the upstream body. */
  ttl?: number;
  /** Expected error instead of a result. */
  error?: RegExp;
};

const BOM = "﻿";

const toolsByName = new Map(services.flatMap((service) => service.tools.map((tool) => [tool.name, { service, tool }] as const)));

function find(name: string): { service: ServiceDefinition; tool: ToolDefinition } {
  const entry = toolsByName.get(name);
  if (!entry) throw new Error(`No generated tool named ${name}`);
  return entry;
}

function memoryCache() {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn<(key: string, value: unknown, options?: { ttl?: number }) => Promise<void>>(async (key, value) => void store.set(key, value)),
    delete: vi.fn(async () => {}),
    expireTag: vi.fn(async () => {}),
  };
}

const holidayFeed = BOM + JSON.stringify({
  vcalendar: [
    {
      vevent: [
        { dtstart: ["20261001", { value: "DATE" }], summary: "National Day" },
        { dtstart: ["20250101", { value: "DATE" }], summary: "The first day of January" },
        { dtstart: ["20260101", { value: "DATE" }], summary: "The first day of January" },
      ],
    },
  ],
});

/** The EPD beach grading RSS, trimmed: one item per [code, title, latitude, longitude]. */
function beachFeed(lang: string, items: Array<[string, string, string, string]>) {
  const item = ([code, title, lat, lon]: [string, string, string, string]) =>
    `<item><title>${title}</title><link>https://cd.epic.epd.gov.hk/EPICDI/beach/gradingreport/${code}/?lang=${lang}</link><description>&lt;table border='1'&gt;&lt;tr&gt;&lt;td width='150px'&gt;Latitude (N):&lt;/td&gt;&lt;td width='150px'&gt;${lat}&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td width='150px'&gt;Longitude (E):&lt;/td&gt;&lt;td&gt;${lon}&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;</description><pubDate>Fri, 16 Oct 2026 14:04:42</pubDate></item>`;
  return `<?xml version='1.0' encoding='utf-8'?><?xml-stylesheet type='text/xsl' href='../beach.xsl'?><rss version="2.0"><channel><title>EPD beach water quality information</title><pubDate>Fri, 16 Oct 2026 14:04:42</pubDate><lastBuildDate>Fri, 16 Oct 2026 14:04:42</lastBuildDate>${items.map(item).join("")}</channel></rss>`;
}

const cases: Case[] = [
  // citybus
  {
    tool: "citybus_routes",
    input: { route: "a21" },
    request: { url: "https://rt.data.gov.hk/v2/transport/citybus/route/ctb" },
    reply: { data: [{ route: "A21", orig_en: "Hung Hom", dest_en: "Airport" }, { route: "8", orig_en: "Wan Chai", dest_en: "Heng Fa Chuen" }] },
    data: [{ route: "A21", orig_en: "Hung Hom", dest_en: "Airport" }],
    meta: { total: 1, returned: 1, truncated: false },
  },
  {
    name: "citybus_routes searches origin and destination",
    tool: "citybus_routes",
    input: { search: "chuen" },
    request: { url: "https://rt.data.gov.hk/v2/transport/citybus/route/ctb" },
    reply: { data: [{ route: "A21", orig_en: "Hung Hom", dest_en: "Airport" }, { route: "8", orig_en: "Wan Chai", dest_en: "Heng Fa Chuen" }] },
    data: [{ route: "8", orig_en: "Wan Chai", dest_en: "Heng Fa Chuen" }],
  },
  {
    tool: "citybus_stop",
    input: { stopId: "001313" },
    request: { url: "https://rt.data.gov.hk/v2/transport/citybus/stop/001313" },
    reply: { type: "Stop", data: { stop: "001313", name_en: "Queensway", lat: "22.27", long: "114.16" } },
    data: { stop: "001313", name_en: "Queensway", lat: "22.27", long: "114.16" },
    ttl: 86400,
  },
  {
    tool: "citybus_route_stops",
    input: { route: "a21" },
    request: { url: "https://rt.data.gov.hk/v2/transport/citybus/route-stop/ctb/A21/outbound" },
    reply: { data: [{ seq: 1, stop: "001313" }, { seq: 2, stop: "001314" }] },
    lookups: {
      "https://rt.data.gov.hk/v2/transport/citybus/stop/001313": { data: { stop: "001313", name_en: "Queensway", name_tc: "金鐘道", lat: "22.27", long: "114.16" } },
      "https://rt.data.gov.hk/v2/transport/citybus/stop/001314": { data: { stop: "001314", name_en: "Pacific Place", name_tc: "太古廣場", lat: "22.28", long: "114.17" } },
    },
    data: [
      { seq: 1, stop: "001313", name_en: "Queensway", name_tc: "金鐘道", name_sc: undefined, lat: "22.27", long: "114.16" },
      { seq: 2, stop: "001314", name_en: "Pacific Place", name_tc: "太古廣場", name_sc: undefined, lat: "22.28", long: "114.17" },
    ],
    meta: { total: 2, returned: 2, truncated: false },
  },
  {
    tool: "citybus_eta",
    input: { stopId: "001313", route: "a21" },
    request: { url: "https://rt.data.gov.hk/v2/transport/citybus/eta/ctb/001313/A21" },
    reply: { data: [{ co: "CTB", route: "A21", dir: "O", seq: 3, dest_en: "Airport", eta_seq: 1, eta: "2026-10-18T10:00:00+08:00" }] },
    data: [{ route: "A21", dir: "O", seq: 3, dest_en: "Airport", eta_seq: 1, eta: "2026-10-18T10:00:00+08:00" }],
    ttl: 30,
  },
  {
    name: "citybus_eta needs a route",
    tool: "citybus_eta",
    input: { stopId: "001313" },
    error: /route/,
  },

  // datagovhk-catalog
  {
    tool: "datagovhk_search_datasets",
    input: { query: "weather", apiOnly: true },
    data: {
      results: [
        {
          id: "hk-hko-rss-current-weather-report",
          title: "Current Weather Report",
          titleTc: "本港地區天氣報告",
          provider: "Hong Kong Observatory",
          categories: ["climate-and-weather"],
          formats: ["JSON"],
          hasApi: true,
          url: "https://data.gov.hk/en-data/dataset/hk-hko-rss-current-weather-report",
          mcprouterServices: ["hko-weather"],
        },
      ],
    },
  },
  {
    name: "datagovhk_search_datasets filters by category",
    tool: "datagovhk_search_datasets",
    input: { category: "transport" },
    data: { results: [expect.objectContaining({ id: "hk-td-parking", provider: "hk-td", mcprouterServices: [] })] },
  },
  {
    tool: "datagovhk_dataset_details",
    input: { id: "hk-hko-rss-current-weather-report", lang: "tc" },
    request: { url: "https://data.gov.hk/tc-data/api/3/action/package_show?id=hk-hko-rss-current-weather-report" },
    reply: { success: true, result: { name: "hk-hko-rss-current-weather-report", title: "本港地區天氣報告", resources: [{ format: "JSON" }], state: "active" } },
    data: { name: "hk-hko-rss-current-weather-report", title: "本港地區天氣報告", resources: [{ format: "JSON" }] },
  },
  {
    tool: "datagovhk_archive_list_files",
    input: { start: "20260101", end: "20260131", provider: "hk-td", format: "csv" },
    request: { url: "https://api.data.gov.hk/v1/historical-archive/list-files?start=20260101&end=20260131&provider=hk-td&format=csv&max=20" },
    reply: { "file-count": 1, files: [{ url: "https://td.test/a.csv" }] },
    data: [{ url: "https://td.test/a.csv" }],
  },
  {
    name: "datagovhk_archive_list_files rejects a malformed date",
    tool: "datagovhk_archive_list_files",
    input: { start: "2026-01-01", end: "20260131" },
    error: /start/,
  },
  {
    tool: "datagovhk_archive_file_versions",
    input: { url: "https://td.test/a.csv", start: "20260101", end: "20260102" },
    request: { url: "https://api.data.gov.hk/v1/historical-archive/list-file-versions?url=https%3A%2F%2Ftd.test%2Fa.csv&start=20260101&end=20260102" },
    reply: { timestamps: ["20260101-0900", "20260102-0900"] },
    data: { timestamps: ["20260101-0900", "20260102-0900"] },
  },
  {
    tool: "datagovhk_get_resource",
    input: { dataset: "hk-td-a", resource: "Vacancy", maxChars: 1000 },
    lookups: {
      "https://data.gov.hk/en-data/api/3/action/package_show?id=hk-td-a": {
        result: { resources: [{ id: "r1", name: "Info", format: "JSON", url: "https://td.test/info.json" }, { id: "r2", name: "Vacancy", format: "XML", url: "https://td.test/vacancy.xml" }] },
      },
    },
    request: { url: "https://td.test/vacancy.xml" },
    reply: "x".repeat(1500),
    data: {
      dataset: "hk-td-a",
      resource: { id: "r2", name: "Vacancy", format: "XML", url: "https://td.test/vacancy.xml" },
      content: "x".repeat(1000),
      omittedCharacters: 500,
    },
    ttl: 300,
  },
  {
    name: "datagovhk_get_resource defaults to the first resource",
    tool: "datagovhk_get_resource",
    input: { dataset: "hk-td-a" },
    lookups: { "https://data.gov.hk/en-data/api/3/action/package_show?id=hk-td-a": { result: { resources: [{ id: "r1", name: "Info", format: "JSON", url: "https://td.test/info.json" }] } } },
    request: { url: "https://td.test/info.json" },
    reply: '{"ok":true}',
    data: { dataset: "hk-td-a", resource: { id: "r1", name: "Info", format: "JSON", url: "https://td.test/info.json" }, content: '{"ok":true}', omittedCharacters: 0 },
  },
  {
    tool: "datagovhk_archive_get_file",
    input: { url: "https://td.test/a.csv", time: "20260101-0900", maxChars: 1000 },
    request: { url: "https://api.data.gov.hk/v1/historical-archive/get-file?url=https%3A%2F%2Ftd.test%2Fa.csv&time=20260101-0900" },
    reply: "x".repeat(1500),
    data: { content: "x".repeat(1000), omittedCharacters: 500 },
    ttl: 86400,
  },
  {
    tool: "datagovhk_filter_csv",
    input: { resource: "https://td.test/a.csv", filters: '[[1,"eq",["Central"]]]', sorts: '[[2,"desc"]]', limit: 1 },
    request: {
      url: `https://api.data.gov.hk/v2/filter?q=${encodeURIComponent(
        JSON.stringify({ resource: "https://td.test/a.csv", section: 1, format: "json", filters: [[1, "eq", ["Central"]]], sorts: [[2, "desc"]] }),
      ).replaceAll("%20", "+")}`,
    },
    reply: [{ district: "Central", count: 9 }, { district: "Central", count: 3 }],
    data: { rows: [{ district: "Central", count: 9 }], total: 2, truncated: true },
  },
  {
    name: "datagovhk_filter_csv refuses filters that are not a JSON array",
    tool: "datagovhk_filter_csv",
    input: { resource: "https://td.test/a.csv", filters: "district = Central" },
    error: /filters must be a JSON array/,
  },

  // epd-aqhi
  {
    tool: "aqhi_current",
    input: { station: "central" },
    request: { url: "https://www.aqhi.gov.hk/epd/ddata/html/out/aqhi_ind_rss_Eng.xml" },
    reply: [
      `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Environmental Protection Department - AQHI</title><lastBuildDate>Sun, 18 Oct 2026 22:30:00 +0800</lastBuildDate>`,
      `<item><title>Central/Western</title><link>https://www.aqhi.gov.hk/en/aqhi/past-24-hours-aqhi.html?mid=0</link><pubDate>Sun, 18 Oct 2026 22:30:00 +0800</pubDate><description><![CDATA[Central/Western - General Stations: 3 Low - Sun, 18 Oct 2026 22:30]]></description></item>`,
      `<item><title>Mong Kok</title><link>https://www.aqhi.gov.hk/en/aqhi/past-24-hours-aqhi.html?mid=17</link><pubDate>Sun, 18 Oct 2026 22:30:00 +0800</pubDate><description><![CDATA[Mong Kok - Roadside Stations: 8 Very High - Sun, 18 Oct 2026 22:30]]></description></item>`,
      `<item><title>Central</title><link>https://www.aqhi.gov.hk/en/aqhi/past-24-hours-aqhi.html?mid=16</link><pubDate>Sun, 18 Oct 2026 22:30:00 +0800</pubDate><description><![CDATA[Central - Roadside Stations: 10+ Serious - Sun, 18 Oct 2026 22:30]]></description></item>`,
      `</channel></rss>`,
    ].join(""),
    // "central" is exactly the roadside station, so Central/Western is left out.
    data: { updated: "2026-10-18T22:30:00+08:00", stations: [{ station: "Central", type: "roadside", aqhi: 10, risk: "serious", riskLabel: "Serious" }] },
    ttl: 600,
  },
  {
    name: "aqhi_current finds stations by an English name in Chinese and filters by type",
    tool: "aqhi_current",
    input: { station: "sha", type: "general", lang: "tc" },
    request: { url: "https://www.aqhi.gov.hk/epd/ddata/html/out/aqhi_ind_rss_ChT.xml" },
    reply: [
      `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><lastBuildDate>Sun, 18 Oct 2026 22:30:00 +0800</lastBuildDate>`,
      `<item><title>深水埗</title><description><![CDATA[深水埗 - 一般監測站: 2 低 - 2026年10月18日 (星期日)]]></description></item>`,
      `<item><title>沙田</title><description><![CDATA[沙田 - 一般監測站: 4 中 - 2026年10月18日 (星期日)]]></description></item>`,
      `<item><title>旺角</title><description><![CDATA[旺角 - 路邊監測站: 3 低 - 2026年10月18日 (星期日)]]></description></item>`,
      `</channel></rss>`,
    ].join(""),
    data: {
      updated: "2026-10-18T22:30:00+08:00",
      stations: [
        { station: "深水埗", type: "general", aqhi: 2, risk: "low", riskLabel: "低" },
        { station: "沙田", type: "general", aqhi: 4, risk: "moderate", riskLabel: "中" },
      ],
    },
  },
  {
    tool: "aqhi_forecast",
    input: {},
    request: { url: "https://www.aqhi.gov.hk/epd/ddata/html/out/aqhirss_Eng.xml" },
    reply: [
      `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Environmental Protection Department - AQHI</title><lastBuildDate>Sun, 18 Oct 2026 22:30:00 +0800</lastBuildDate>`,
      `<item><title>HKSAR Air Quality Health Index at : Sun, 18 Oct 2026 22:30:00 +0800 Current Condition : </title><description><![CDATA[<p>General Stations: 2 to 3 (Health Risk: Low)</p><p>Roadside Stations: 3 (Health Risk: Low)</p>]]></description></item>`,
      `<item><title>Forecast of Health Risk: </title><description><![CDATA[<p>&lt;Tomorrow A.M.&gt;<p>General Stations: Low to Moderate</p><p>Roadside Stations: Moderate</p></p><p>&lt;Tomorrow P.M.&gt;<p>General Stations: Low</p><p>Roadside Stations: Low to Moderate</p></p>]]></description></item>`,
      `</channel></rss>`,
    ].join(""),
    data: {
      updated: "2026-10-18T22:30:00+08:00",
      current: {
        general: { aqhiMin: 2, aqhiMax: 3, risk: "Low", riskLevels: ["low"] },
        roadside: { aqhiMin: 3, aqhiMax: 3, risk: "Low", riskLevels: ["low"] },
      },
      forecast: [
        { period: "Tomorrow A.M.", general: { risk: "Low to Moderate", riskLevels: ["low", "moderate"] }, roadside: { risk: "Moderate", riskLevels: ["moderate"] } },
        { period: "Tomorrow P.M.", general: { risk: "Low", riskLevels: ["low"] }, roadside: { risk: "Low to Moderate", riskLevels: ["low", "moderate"] } },
      ],
    },
    ttl: 600,
  },
  {
    name: "aqhi_forecast reads the Simplified Chinese feed",
    tool: "aqhi_forecast",
    input: { lang: "sc" },
    request: { url: "https://www.aqhi.gov.hk/epd/ddata/html/out/aqhirss_ChS.xml" },
    reply: [
      `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><lastBuildDate>Sun, 18 Oct 2026 22:30:00 +0800</lastBuildDate>`,
      `<item><title>香港空气质素健康指数</title><description><![CDATA[<p>一般监测站: 7 to 10+ (健康风险:高 至 严重)</p><p>路边监测站: 3 (健康风险:低)</p>]]></description></item>`,
      `<item><title>健康风险预测：</title><description><![CDATA[<p>&lt;明天 上午&gt;<p>一般监测站: 甚高</p><p>路边监测站: 低 至 中</p></p>]]></description></item>`,
      `</channel></rss>`,
    ].join(""),
    data: {
      updated: "2026-10-18T22:30:00+08:00",
      current: {
        general: { aqhiMin: 7, aqhiMax: 10, risk: "高 至 严重", riskLevels: ["high", "serious"] },
        roadside: { aqhiMin: 3, aqhiMax: 3, risk: "低", riskLevels: ["low"] },
      },
      forecast: [{ period: "明天 上午", general: { risk: "甚高", riskLevels: ["very_high"] }, roadside: { risk: "低 至 中", riskLevels: ["low", "moderate"] } }],
    },
  },
  {
    tool: "aqhi_past_24h",
    input: { station: "旺角" },
    request: { url: "https://www.aqhi.gov.hk/epd/ddata/html/out/24aqhi_Eng.xml" },
    reply: [
      `<?xml version="1.0" encoding="UTF-8"?><AQHI24HrReport><title>Environmental Protection Department - AQHI</title><lastBuildDate>Sun, 18 Oct 2026 22:30:00 +0800</lastBuildDate>`,
      `<item><type>General Stations</type><StationName>Central/Western</StationName><DateTime>Sun, 18 Oct 2026 21:00:00 +0800</DateTime><aqhi>3</aqhi></item>`,
      `<item><type>Roadside Stations</type><StationName>Mong Kok</StationName><DateTime>Sun, 18 Oct 2026 20:00:00 +0800</DateTime><aqhi>4</aqhi></item>`,
      `<item><type>Roadside Stations</type><StationName>Mong Kok</StationName><DateTime>Sun, 18 Oct 2026 21:00:00 +0800</DateTime><aqhi></aqhi></item>`,
      `<item><type>Roadside Stations</type><StationName>Mong Kok</StationName><DateTime>Sun, 18 Oct 2026 22:00:00 +0800</DateTime><aqhi>3</aqhi></item>`,
      `</AQHI24HrReport>`,
    ].join(""),
    data: {
      updated: "2026-10-18T22:30:00+08:00",
      stations: [
        {
          station: "Mong Kok",
          type: "roadside",
          highest: { time: "2026-10-18T20:00:00+08:00", aqhi: 4, risk: "moderate" },
          readings: [
            { time: "2026-10-18T20:00:00+08:00", aqhi: 4, risk: "moderate" },
            { time: "2026-10-18T21:00:00+08:00", aqhi: null, risk: null },
            { time: "2026-10-18T22:00:00+08:00", aqhi: 3, risk: "low" },
          ],
        },
      ],
    },
    ttl: 600,
  },
  {
    name: "aqhi_past_24h needs a station",
    tool: "aqhi_past_24h",
    input: {},
    error: /station/,
  },

  // epd-beach
  {
    tool: "beach_water_quality",
    input: { district: "southern", maxGrade: 2 },
    request: { url: "https://cd.epic.epd.gov.hk/beachpsi/en/beach2.rss" },
    reply: beachFeed("en", [
      ["ANG", "Anglers' Beach  water quality was rated as Fair(Grade 2)", `22° 21' 53"`, `114° 3' 21"`],
      ["DW", "Deep Water Bay Beach water quality was rated as Poor(Grade 3)", `22° 14' 20"`, `114° 11' 2"`],
      ["RB", "Repulse Bay Beach water quality was rated as Good(Grade 1)", `22° 14' 7"`, `114° 11' 47"`],
    ]),
    data: {
      updated: "2026-10-16T14:04:42+08:00",
      count: 1,
      beaches: [
        { code: "RB", name: "Repulse Bay Beach", district: "Southern", grade: 1, rating: "Good", latitude: 22.23528, longitude: 114.19639, report: "https://cd.epic.epd.gov.hk/EPICDI/beach/gradingreport/RB/?lang=en" },
      ],
    },
    ttl: 1800,
  },
  {
    name: "beach_water_quality finds a beach by its English name and answers in Chinese",
    tool: "beach_water_quality",
    input: { beach: "anglers", lang: "tc" },
    request: { url: "https://cd.epic.epd.gov.hk/beachpsi/tc/beach2.rss" },
    reply: beachFeed("zh", [
      ["ANG", "釣魚灣泳灘的水質被評為一般(二級)", `22° 21' 53"`, `114° 3' 21"`],
      ["XYZ", "新泳灘的水質暫停評級", `22° 0' 0"`, `114° 0' 0"`],
    ]),
    lookups: {
      "https://cd.epic.epd.gov.hk/beachpsi/en/beach2.rss": beachFeed("en", [
        ["ANG", "Anglers' Beach  water quality was rated as Fair(Grade 2)", `22° 21' 53"`, `114° 3' 21"`],
        ["XYZ", "New Beach water quality grading suspended", `22° 0' 0"`, `114° 0' 0"`],
      ]),
      "https://cd.epic.epd.gov.hk/beachpsi/sc/beach2.rss": beachFeed("zh_cn", [["ANG", "钓鱼湾泳滩的水质被评为一般(二级)", `22° 21' 53"`, `114° 3' 21"`]]),
    },
    data: {
      updated: "2026-10-16T14:04:42+08:00",
      count: 1,
      beaches: [
        { code: "ANG", name: "釣魚灣泳灘", district: "荃灣", grade: 2, rating: "一般", latitude: 22.36472, longitude: 114.05583, report: "https://cd.epic.epd.gov.hk/EPICDI/beach/gradingreport/ANG/?lang=zh" },
      ],
    },
  },
  {
    name: "beach_water_quality keeps a beach the feed gives no grade for",
    tool: "beach_water_quality",
    input: { lang: "sc" },
    request: { url: "https://cd.epic.epd.gov.hk/beachpsi/sc/beach2.rss" },
    reply: beachFeed("zh_cn", [["XYZ", "新泳滩的水质暂停评级", `22° 0' 0"`, `114° 0' 0"`]]),
    data: {
      updated: "2026-10-16T14:04:42+08:00",
      count: 1,
      beaches: [
        { code: "XYZ", name: "新泳滩", district: null, grade: null, rating: null, latitude: 22, longitude: 114, report: "https://cd.epic.epd.gov.hk/EPICDI/beach/gradingreport/XYZ/?lang=zh_cn", note: "新泳滩的水质暂停评级" },
      ],
    },
  },

  // gmb (green minibus)
  {
    tool: "gmb_routes",
    input: { region: "KLN" },
    request: { url: "https://data.etagmb.gov.hk/route/KLN" },
    reply: { data: { routes: ["12", "12A", "44M"] } },
    data: ["12", "12A", "44M"],
    meta: { total: 3, returned: 3, truncated: false },
    ttl: 86400,
  },
  {
    name: "gmb_routes needs a known region",
    tool: "gmb_routes",
    input: { region: "Kowloon" },
    error: /region/,
  },
  {
    tool: "gmb_route",
    input: { region: "KLN", route: "44m" },
    request: { url: "https://data.etagmb.gov.hk/route/KLN/44M" },
    reply: { data: [{ route_id: 2004791, route_code: "44M", directions: [{ route_seq: 1, orig_en: "Tsui Ping", dest_en: "Kwun Tong" }] }] },
    data: [{ route_id: 2004791, route_code: "44M", directions: [{ route_seq: 1, orig_en: "Tsui Ping", dest_en: "Kwun Tong" }] }],
  },
  {
    tool: "gmb_route_stops",
    input: { routeId: "2002329" },
    request: { url: "https://data.etagmb.gov.hk/route-stop/2002329/1" },
    reply: { data: { route_stops: [{ stop_seq: 1, stop_id: 20021844, name_en: "Pak Tin" }] } },
    data: [{ stop_seq: 1, stop_id: 20021844, name_en: "Pak Tin" }],
  },
  {
    tool: "gmb_stop",
    input: { stopId: "20000859" },
    request: { url: "https://data.etagmb.gov.hk/stop/20000859" },
    reply: { data: { coordinates: { wgs84: { latitude: 22.3356, longitude: 114.1662 } }, enabled: true } },
    data: { coordinates: { wgs84: { latitude: 22.3356, longitude: 114.1662 } }, enabled: true },
  },
  {
    tool: "gmb_stop_routes",
    input: { stopId: "20000859" },
    request: { url: "https://data.etagmb.gov.hk/stop-route/20000859" },
    reply: { data: [{ route_id: 2002329, route_seq: 1, stop_seq: 2 }] },
    data: [{ route_id: 2002329, route_seq: 1, stop_seq: 2 }],
  },
  {
    tool: "gmb_stop_eta",
    input: { stopId: "20000859" },
    request: { url: "https://data.etagmb.gov.hk/eta/stop/20000859" },
    reply: { data: [{ route_id: 2005690, route_seq: 1, stop_seq: 13, enabled: true, eta: [{ eta_seq: 1, diff: 4, remarks_en: null }] }] },
    data: [{ route_id: 2005690, route_seq: 1, stop_seq: 13, enabled: true, eta: [{ eta_seq: 1, diff: 4, remarks_en: null }] }],
    ttl: 30,
  },
  {
    tool: "gmb_route_stop_eta",
    input: { routeId: "2002329", routeSeq: 2, stopSeq: 3 },
    request: { url: "https://data.etagmb.gov.hk/eta/route-stop/2002329/2/3" },
    reply: { data: { stop_id: 20000859, enabled: true, eta: [] } },
    data: { stop_id: 20000859, enabled: true, eta: [] },
    ttl: 30,
  },

  // nlb (New Lantao Bus)
  {
    tool: "nlb_routes",
    input: { route: "1", search: "tai o" },
    request: { url: "https://rt.data.gov.hk/v2/transport/nlb/route.php?action=list" },
    reply: {
      routes: [
        { routeId: "1", routeNo: "1", routeName_e: "Mui Wo Ferry Pier > Tai O", routeName_c: "梅窩碼頭 > 大澳", routeName_s: "梅窝码头 > 大澳", overnightRoute: 0, specialRoute: 0 },
        { routeId: "3", routeNo: "1R", routeName_e: "Hung Hom > Ngong Ping", routeName_c: "紅磡 > 昂坪", routeName_s: "红磡 > 昂坪", overnightRoute: 0, specialRoute: 0 },
      ],
    },
    data: [{ routeId: "1", routeNo: "1", routeName_en: "Mui Wo Ferry Pier > Tai O", routeName_tc: "梅窩碼頭 > 大澳", routeName_sc: "梅窝码头 > 大澳", overnightRoute: 0, specialRoute: 0 }],
    ttl: 86400,
  },
  {
    tool: "nlb_route_stops",
    input: { routeId: "1" },
    request: { url: "https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId=1" },
    reply: { stops: [{ stopId: "1", stopName_e: "Mui Wo Ferry Pier", stopName_c: "梅窩碼頭", latitude: "22.264664", longitude: "114.001554", fare: "12.7" }] },
    data: [{ stopId: "1", stopName_en: "Mui Wo Ferry Pier", stopName_tc: "梅窩碼頭", latitude: "22.264664", longitude: "114.001554", fare: "12.7" }],
  },
  {
    tool: "nlb_eta",
    input: { routeId: "1", stopId: "1" },
    request: { url: "https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=estimatedArrivals&routeId=1&stopId=1&language=en" },
    reply: { estimatedArrivals: [{ estimatedArrivalTime: "2026-10-18 17:00:00", routeVariantName: "", departed: "0" }], message: "Scheduled times" },
    data: { estimatedArrivals: [{ estimatedArrivalTime: "2026-10-18 17:00:00", routeVariantName: "", departed: "0" }], message: "Scheduled times" },
    ttl: 30,
  },

  // tram (Hong Kong Tramways)
  {
    tool: "tram_routes",
    input: { search: "kennedy" },
    lookups: {
      "https://static.data.gov.hk/tramways/datasets/main_routes/tramways_main_routes_en.csv": `${BOM}Route ID,Route start,Route end\n1,Western Market,Shau Kei Wan\n5,Kennedy Town,Happy Valley\n`,
      "https://static.data.gov.hk/tramways/datasets/main_routes/tramways_main_routes_tc.csv": `${BOM}路線號碼,路線起點,路線終點\n1,上環西港城,筲箕灣\n5,堅尼地城,跑馬地\n`,
      "https://static.data.gov.hk/tramways/datasets/main_routes/tramways_main_routes_sc.csv": `${BOM}路线号码,路线起点,路线终点\n1,上环西港城,筲箕湾\n5,坚尼地城,跑马地\n`,
    },
    data: [{ route: "5", orig_en: "Kennedy Town", orig_tc: "堅尼地城", orig_sc: "坚尼地城", dest_en: "Happy Valley", dest_tc: "跑馬地", dest_sc: "跑马地" }],
    ttl: 86400,
  },
  {
    tool: "tram_stops",
    input: { direction: "westbound", search: "柴灣" },
    lookups: {
      "https://static.data.gov.hk/tramways/datasets/tram_stops/summary_tram_stops_en.csv": `${BOM}"Traveling Direction","Stops Code","Stops Name"\n"Westbound","T","Shau Kei Wan Terminus"\n"Westbound","02W","Chai Wan Road"\n"Eastbound","01E","Chai Wan Road"\n`,
      "https://static.data.gov.hk/tramways/datasets/tram_stops/summary_tram_stops_tc.csv": `${BOM}"行駛方向","車站代號","車站名稱"\n"西行","T","筲箕灣總站"\n"西行","02W","柴灣道"\n"東行","01E","柴灣道"\n`,
      "https://static.data.gov.hk/tramways/datasets/tram_stops/summary_tram_stops_sc.csv": `${BOM}"行驶方向","车站代号","车站名称"\n"西行","T","筲箕湾总站"\n"西行","02W","柴湾道"\n"东行","01E","柴湾道"\n`,
    },
    data: [{ direction: "westbound", stop: "02W", name_en: "Chai Wan Road", name_tc: "柴灣道", name_sc: "柴湾道" }],
  },

  // ha-aed
  {
    tool: "ha_aed_waiting_times",
    input: { lang: "tc", hospital: "queen" },
    request: { url: "https://www.ha.org.hk/opendata/aed/aedwtdata2-tc.json" },
    reply: { waitTime: [{ hospName: "Queen Mary Hospital", t3p50: "1 hour" }, { hospName: "Tuen Mun Hospital", t3p50: "2 hours" }], updateTime: "18/10/2026 10:00am" },
    data: [{ hospName: "Queen Mary Hospital", t3p50: "1 hour" }],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 300,
  },

  // hk-border
  {
    tool: "border_waiting_times",
    input: { controlPoint: "lo wu" },
    request: { url: "https://secure1.info.gov.hk/immd/mobileapps/2bb9ae17/data/CPQueueTimeR.json" },
    reply: { LWS: { arrQueue: 1, depQueue: 0 }, SBC: { arrQueue: 99, depQueue: 99 } },
    lookups: { "https://secure1.info.gov.hk/immd/mobileapps/2bb9ae17/data/CPQueueTimeV.json": { LWS: { arrQueue: 2, depQueue: 4 }, SBC: { arrQueue: 99, depQueue: 99 } } },
    data: {
      controlPoints: [
        {
          code: "LWS",
          name: "Lo Wu",
          residents: { arrival: { status: "busy", label: "Busy", wait: "generally under 30 min" }, departure: { status: "normal", label: "Normal", wait: "generally under 15 min" } },
          visitors: { arrival: { status: "very_busy", label: "Very busy", wait: "generally 45 min or more" }, departure: { status: "maintenance", label: "System under maintenance", wait: null } },
        },
      ],
    },
    ttl: 300,
  },
  {
    name: "border_waiting_times finds a control point by its Chinese name",
    tool: "border_waiting_times",
    input: { controlPoint: "深圳灣", lang: "tc" },
    request: { url: "https://secure1.info.gov.hk/immd/mobileapps/2bb9ae17/data/CPQueueTimeR.json" },
    reply: { LWS: { arrQueue: 0, depQueue: 0 }, SBC: { arrQueue: 99, depQueue: 0 } },
    lookups: { "https://secure1.info.gov.hk/immd/mobileapps/2bb9ae17/data/CPQueueTimeV.json": { LWS: { arrQueue: 0, depQueue: 0 }, SBC: { arrQueue: 99, depQueue: 7 } } },
    data: {
      controlPoints: [
        {
          code: "SBC",
          name: "深圳灣",
          residents: { arrival: { status: "closed", label: "非服務時間", wait: null }, departure: { status: "normal", label: "正常", wait: "一般少於 15 分鐘" } },
          visitors: { arrival: { status: "closed", label: "非服務時間", wait: null }, departure: { status: "unknown", label: "未知", wait: null } },
        },
      ],
    },
  },
  {
    tool: "border_daily_passengers",
    input: { controlPoint: "lo" },
    request: { url: "https://www.immd.gov.hk/opendata/eng/transport/immigration_clearance/statistics_on_daily_passenger_traffic.csv" },
    reply: [
      `${BOM}Date,Control Point,Arrival / Departure,Hong Kong Residents,Mainland Visitors,Other Visitors,Total,`,
      "16-10-2026,Lo Wu,Arrival,1,2,3,6,",
      "17-10-2026,Airport,Arrival,10,20,30,60,",
      "17-10-2026,Lo Wu,Arrival,100,200,300,600,",
      "17-10-2026,Lo Wu,Departure,400,500,600,1500,",
      "17-10-2026,Lok Ma Chau,Departure,1,1,1,3,",
    ].join("\n"),
    data: {
      date: "2026-10-17",
      latestDate: "2026-10-17",
      total: {
        arrival: { hongKongResidents: 100, mainlandVisitors: 200, otherVisitors: 300, total: 600 },
        departure: { hongKongResidents: 401, mainlandVisitors: 501, otherVisitors: 601, total: 1503 },
      },
      controlPoints: [
        { controlPoint: "Lo Wu", arrival: { hongKongResidents: 100, mainlandVisitors: 200, otherVisitors: 300, total: 600 }, departure: { hongKongResidents: 400, mainlandVisitors: 500, otherVisitors: 600, total: 1500 } },
        { controlPoint: "Lok Ma Chau", arrival: null, departure: { hongKongResidents: 1, mainlandVisitors: 1, otherVisitors: 1, total: 3 } },
      ],
    },
    ttl: 21600,
  },
  {
    name: "border_daily_passengers reads a past day in Chinese and says when a day is missing",
    tool: "border_daily_passengers",
    input: { date: "2026-10-16", lang: "tc" },
    request: { url: "https://www.immd.gov.hk/opendata/hkt/transport/immigration_clearance/statistics_on_daily_passenger_traffic.csv" },
    reply: `${BOM}日期,管制站,入境 / 出境,香港居民,內地訪客,其他訪客,總計\n16-10-2026,羅湖,入境,1,2,3,6\n17-10-2026,羅湖,出境,1,2,3,6\n`,
    data: {
      date: "2026-10-16",
      latestDate: "2026-10-17",
      total: { arrival: { hongKongResidents: 1, mainlandVisitors: 2, otherVisitors: 3, total: 6 }, departure: { hongKongResidents: 0, mainlandVisitors: 0, otherVisitors: 0, total: 0 } },
      controlPoints: [{ controlPoint: "羅湖", arrival: { hongKongResidents: 1, mainlandVisitors: 2, otherVisitors: 3, total: 6 }, departure: null }],
    },
  },
  {
    tool: "border_annual_traffic",
    input: { year: 2025 },
    request: { url: "https://www.immd.gov.hk/opendata/eng/transport/immigration_clearance/statistics_passenger_visitor_vehicular_traffic.csv" },
    reply: `${BOM}Year,Passenger Traffic,Passenger Traffic - Air,Passenger Traffic - Sea,Passenger Traffic - Land,Vehicular traffic to and from the Mainland,Visitors\n2024,298.5,41.9,8.8,247.8,15.5,89\n2025,334.6,45.3,8.4,280.9,18.1,99.7`,
    data: {
      unit: "million trips",
      years: [{ year: 2025, passengerTrips: 334.6, passengerTripsByAir: 45.3, passengerTripsBySea: 8.4, passengerTripsByLand: 280.9, vehicleTripsToAndFromMainland: 18.1, visitorTrips: 99.7 }],
    },
    ttl: 86400,
  },
  {
    tool: "border_passenger_throughput",
    input: { year: 2025, controlPoint: "h" },
    request: { url: "https://www.customs.gov.hk/hcms/filemanager/common/csv/statistics/passenger_entry_exit_en.csv" },
    reply: [
      `${BOM}Control Points,Year,Passenger Throughput '000`,
      "OVERALL,2025,334632",
      "HK International Airport,2024,41876",
      "HK International Airport,2025,45324",
      "Hung Hom Station (Through Train) (Passenger clearance services have been temporarily suspended starting from 30 January 2020.),2025,0",
    ].join("\r\n"),
    data: [
      { controlPoint: "HK International Airport", year: 2025, passengersThousands: 45324 },
      { controlPoint: "Hung Hom Station (Through Train)", note: "Passenger clearance services have been temporarily suspended starting from 30 January 2020.", year: 2025, passengersThousands: 0 },
    ],
    ttl: 86400,
  },
  {
    tool: "border_vehicle_throughput",
    input: { quarter: 2, lang: "sc" },
    request: { url: "https://www.customs.gov.hk/hcms/filemanager/common/csv/statistics/passenger_land_sc.csv" },
    // The Simplified Chinese file ends its header line with a bare CR.
    reply: `${BOM}陆路边境管制站,车,年度,季度,车辆流量-千次\r总计,总计,2025,第2季,9\r\n深圳湾,总计,2025,第2季,6\r\n深圳湾,货运车,2025,第2季,2\r\n深圳湾,客运车,2025,第2季,1\r\n深圳湾,私家车,2025,第2季,3\r\n深圳湾,总计,2026,第1季,7\r\n深圳湾,总计,2026,第2季,8\r\n`,
    data: [
      { controlPoint: "深圳湾", year: 2026, quarter: 2, total: 8, goodsVehicles: null, passengerVehicles: null, privateCars: null },
    ],
  },
  {
    name: "border_vehicle_throughput pivots one year's vehicle types",
    tool: "border_vehicle_throughput",
    input: { year: 2025, controlPoint: "shenzhen" },
    request: { url: "https://www.customs.gov.hk/hcms/filemanager/common/csv/statistics/passenger_land_en.csv" },
    reply: `${BOM}Land Boundary Control Points,Vehicle,Year,Quarter,Vehicular Throughput '000\nOVERALL,Total,2025,Q2,9\nShenzhen Bay,Total,2025,Q2,6\nShenzhen Bay,Goods Vehicles,2025,Q2,2\nShenzhen Bay,Passenger Vehicles,2025,Q2,1\nShenzhen Bay,Private Cars,2025,Q2,3\nShenzhen Bay,Total,2026,Q1,7\n`,
    data: [{ controlPoint: "Shenzhen Bay", year: 2025, quarter: 2, total: 6, goodsVehicles: 2, passengerVehicles: 1, privateCars: 3 }],
  },

  // hk-holidays
  {
    tool: "hk_public_holidays",
    input: { year: 2026 },
    request: { url: "https://www.1823.gov.hk/common/ical/en.json" },
    reply: holidayFeed,
    data: {
      holidays: [{ date: "2026-01-01", name: "The first day of January" }, { date: "2026-10-01", name: "National Day" }],
      coverage: { from: "2025-01-01", to: "2026-10-01" },
    },
    ttl: 86400,
  },
  {
    tool: "hk_is_public_holiday",
    input: { date: "2026-10-01", lang: "sc" },
    request: { url: "https://www.1823.gov.hk/common/ical/sc.json" },
    reply: holidayFeed,
    data: { date: "2026-10-01", isPublicHoliday: true, holiday: "National Day", isSunday: false },
  },
  {
    name: "hk_is_public_holiday warns outside the feed's range",
    tool: "hk_is_public_holiday",
    input: { date: "2030-01-06" },
    request: { url: "https://www.1823.gov.hk/common/ical/en.json" },
    reply: holidayFeed,
    data: { date: "2030-01-06", isPublicHoliday: false, holiday: null, isSunday: true, note: expect.stringMatching(/outside the range/) },
  },

  // hko-regional
  {
    tool: "hko_rainfall_past_hour",
    input: { station: "kings park" },
    request: { url: "https://data.weather.gov.hk/weatherAPI/opendata/hourlyRainfall.php?lang=en" },
    reply: {
      obsTime: "2026-10-18T22:45:00+08:00",
      hourlyRainfall: [
        { automaticWeatherStation: "Lau Fau Shan", automaticWeatherStationID: "RF001", value: "0", unit: "mm" },
        { automaticWeatherStation: "King’s Park", automaticWeatherStationID: "RF024", value: "3", unit: "mm" },
      ],
    },
    data: { observedAt: "2026-10-18T22:45:00+08:00", stations: [{ station: "King’s Park", id: "RF024", rainfallMm: 3 }] },
    ttl: 300,
  },
  {
    name: "hko_rainfall_past_hour keeps only stations with rain, and reads a missing reading as null",
    tool: "hko_rainfall_past_hour",
    input: { rainingOnly: true, lang: "tc" },
    request: { url: "https://data.weather.gov.hk/weatherAPI/opendata/hourlyRainfall.php?lang=tc" },
    reply: {
      obsTime: "2026-10-18T22:45:00+08:00",
      hourlyRainfall: [
        { automaticWeatherStation: "流浮山", automaticWeatherStationID: "RF001", value: "0", unit: "mm" },
        { automaticWeatherStation: "清水灣", automaticWeatherStationID: "RF009", value: "M", unit: "mm" },
        { automaticWeatherStation: "沙田", automaticWeatherStationID: "RF020", value: "12", unit: "mm" },
      ],
    },
    data: { observedAt: "2026-10-18T22:45:00+08:00", stations: [{ station: "沙田", id: "RF020", rainfallMm: 12 }] },
  },
  {
    tool: "hko_uv_index",
    input: {},
    request: { url: "https://data.weather.gov.hk/weatherAPI/hko_data/regional-weather/latest_15min_uvindex.csv" },
    reply: "Date time,past 15-minute mean UV Index\n202610181200,6.4\n",
    data: { observedAt: "2026-10-18T12:00:00+08:00", uvIndex: 6.4, level: "high", label: "High" },
    ttl: 300,
  },
  {
    name: "hko_uv_index reads the Traditional Chinese file",
    tool: "hko_uv_index",
    input: { lang: "tc" },
    request: { url: "https://data.weather.gov.hk/weatherAPI/hko_data/regional-weather/latest_15min_uvindex_uc.csv" },
    reply: `${BOM}日期 時間,過去十五分鐘平均紫外線指數\n202610181800,0.0\n`,
    data: { observedAt: "2026-10-18T18:00:00+08:00", uvIndex: 0, level: "low", label: "低" },
  },
  {
    tool: "hko_lightning",
    input: {},
    request: { url: "https://data.weather.gov.hk/weatherAPI/opendata/opendata.php?dataType=LHL&rformat=csv&lang=en" },
    reply: [
      `${BOM}DateTime,Type,Region,"lightning count"`,
      `202610172100-202610172159,Cloud-to-ground,"New Territories West",4`,
      `202610172100-202610172159,Cloud-to-ground,Lantau,0`,
      `202610172100-202610172159,Cloud-to-ground,"Hong Kong territory",4`,
      `202610172100-202610172159,Cloud-to-cloud,"Hong Kong territory",11`,
    ].join("\n"),
    data: {
      from: "2026-10-17T21:00:00+08:00",
      to: "2026-10-17T21:59:00+08:00",
      total: { cloudToGround: 4, cloudToCloud: 11 },
      cloudToGroundByRegion: [
        { region: "New Territories West", count: 4 },
        { region: "Lantau", count: 0 },
      ],
    },
    ttl: 600,
  },
  {
    name: "hko_lightning reads the Simplified Chinese types and regions",
    tool: "hko_lightning",
    input: { lang: "sc" },
    request: { url: "https://data.weather.gov.hk/weatherAPI/opendata/opendata.php?dataType=LHL&rformat=csv&lang=sc" },
    reply: `${BOM}日期时间,类别,区域,闪电次数\n202610172100-202610172159,云对地,大屿山,0\n202610172100-202610172159,云对地,香港境内,0\n202610172100-202610172159,云间,香港境内,2\n`,
    data: {
      from: "2026-10-17T21:00:00+08:00",
      to: "2026-10-17T21:59:00+08:00",
      total: { cloudToGround: 0, cloudToCloud: 2 },
      cloudToGroundByRegion: [{ region: "大屿山", count: 0 }],
    },
  },
  {
    tool: "hko_regional_weather",
    input: { station: "Hong Kong Observatory" },
    request: { url: "https://data.weather.gov.hk/weatherAPI/hko_data/regional-weather/latest_1min_temperature.csv" },
    reply: "Date time,Automatic Weather Station,Air Temperature(degree Celsius)\n202610182300,Chek Lap Kok,28.2\n202610182300,HK Observatory,27.9\n",
    lookups: {
      "https://data.weather.gov.hk/weatherAPI/hko_data/regional-weather/latest_1min_humidity.csv": "Date time,Automatic Weather Station,Relative Humidity(percent)\n202610182300,HK Observatory,75\n",
      "https://data.weather.gov.hk/weatherAPI/hko_data/regional-weather/latest_1min_pressure.csv": "Date time,Automatic Weather Station,Mean Sea Level Pressure(hPa)\n202610182300,HK Observatory,1016.7\n",
      "https://data.weather.gov.hk/weatherAPI/hko_data/regional-weather/latest_10min_wind.csv":
        "Date time,Automatic Weather Station,10-Minute Mean Wind Direction(Compass points),10-Minute Mean Speed(km/hour),10-Minute Maximum Gust(km/hour)\n202610182300,Central Pier,East,12,17\n",
    },
    data: { observedAt: "2026-10-18T23:00:00+08:00", stations: [{ station: "HK Observatory", temperatureC: 27.9, humidityPercent: 75, pressureHpa: 1016.7 }] },
    ttl: 60,
  },
  {
    name: "hko_regional_weather joins the Chinese files and reads calm and missing wind",
    tool: "hko_regional_weather",
    input: { lang: "tc" },
    request: { url: "https://data.weather.gov.hk/weatherAPI/hko_data/regional-weather/latest_1min_temperature_uc.csv" },
    reply: `${BOM}日期時間,自動氣象站,氣溫（攝氏）\n202610182300,西貢,25.6\n`,
    lookups: {
      "https://data.weather.gov.hk/weatherAPI/hko_data/regional-weather/latest_1min_humidity_uc.csv": `${BOM}日期時間,自動氣象站,相對濕度（百分比）\n202610182300,西貢,85\n`,
      "https://data.weather.gov.hk/weatherAPI/hko_data/regional-weather/latest_1min_pressure_uc.csv": `${BOM}日期時間,自動氣象站,平均海平面氣壓（百帕斯卡）\n`,
      "https://data.weather.gov.hk/weatherAPI/hko_data/regional-weather/latest_10min_wind_uc.csv": `${BOM}日期時間,自動氣象站,十分鐘平均風向（方位點）,十分鐘平均風速（公里/小時）,十分鐘最高陣風風速（公里/小時）\n202610182300,西貢,無風,無風,2,\n202610182300,赤柱,東南,N/A,N/A\n`,
    },
    data: {
      observedAt: "2026-10-18T23:00:00+08:00",
      stations: [
        { station: "西貢", temperatureC: 25.6, humidityPercent: 85, windDirection: "無風", gustKmh: 2 },
        { station: "赤柱", windDirection: "東南" },
      ],
    },
  },
  {
    tool: "hko_heat_stress",
    input: { station: "observatory" },
    request: { url: "https://data.weather.gov.hk/weatherAPI/hko_data/regional-weather/recent10_10min_hkhi.csv" },
    reply: [
      "Date time,Automatic Weather Station,10 minute mean Hong Kong Heat Index",
      "202610182259,Beas River,22.0",
      "202610182259,Hong Kong Observatory,24.4",
      "202610182300,Beas River,22.0",
      "202610182300,Hong Kong Observatory,24.5",
    ].join("\n"),
    lookups: {
      "https://data.weather.gov.hk/weatherAPI/hko_data/regional-weather/recent10_60min_wbgt.csv":
        "Date time,Automatic Weather Station,60-minute mean Wet Bulb Globe Temperature (WBGT)\n202610182259,Hong Kong Observatory,24.5\n202610182300,Hong Kong Observatory,24.6\n",
    },
    data: { observedAt: "2026-10-18T23:00:00+08:00", stations: [{ station: "Hong Kong Observatory", heatIndex: 24.5, wbgtC: 24.6 }] },
    ttl: 60,
  },

  // hko-tides
  {
    tool: "hko_tide_times",
    input: { station: "quarry bay", date: "2026-10-18", days: 2 },
    request: { url: "https://data.weather.gov.hk/weatherAPI/opendata/opendata.php?dataType=HLT&station=QUB&year=2026&rformat=json" },
    reply: {
      fields: ["Month", "Date", "Time", "Height(m)", "Time", "Height(m)", "Time", "Height(m)", "Time", "Height(m)"],
      data: [
        ["10", "17", "1013", "0.98", "1745", "1.63", "2257", "1.55", "", ""],
        ["10", "18", "0030", "2.27", "0947", "1.03", "", "", "", ""],
        ["10", "19", "0059", "2.20", "1021", "1.07", "1802", "1.81", "2324", "1.62"],
      ],
    },
    data: {
      station: { code: "QUB", name: "Quarry Bay" },
      timeZone: "Asia/Hong_Kong",
      heightUnit: "metres above Chart Datum",
      days: [
        { date: "2026-10-18", tides: [{ time: "00:30", type: "high", heightM: 2.27 }, { time: "09:47", type: "low", heightM: 1.03 }] },
        {
          date: "2026-10-19",
          tides: [
            { time: "00:59", type: "high", heightM: 2.2 },
            { time: "10:21", type: "low", heightM: 1.07 },
            { time: "18:02", type: "high", heightM: 1.81 },
            { time: "23:24", type: "low", heightM: 1.62 },
          ],
        },
      ],
    },
    ttl: 86400,
  },
  {
    name: "hko_tide_times warns about a closed station and a year with no predictions",
    tool: "hko_tide_times",
    input: { station: "芝麻灣", date: "2030-01-01", lang: "tc" },
    request: { url: "https://data.weather.gov.hk/weatherAPI/opendata/opendata.php?dataType=HLT&station=CMW&year=2030&rformat=json" },
    reply: "Please include valid parameters in API request. For details, please refer to <a href=\"https://data.weather.gov.hk/weatherAPI/doc/HKO_Open_Data_API_Documentation.pdf\">Hong Kong Observatory Open Data API Documentation</a>.",
    data: {
      station: { code: "CMW", name: "芝麻灣" },
      timeZone: "Asia/Hong_Kong",
      heightUnit: "metres above Chart Datum",
      note: "Chi Ma Wan tide station closed in 1997; its predictions may have large errors. The Observatory has no tide predictions for Chi Ma Wan in 2030.",
      days: [],
    },
  },
  {
    name: "hko_tide_times rejects an unknown station",
    tool: "hko_tide_times",
    input: { station: "Stanley", date: "2026-10-18" },
    error: /Unknown tide station "Stanley".*QUB \(Quarry Bay\)/,
  },
  {
    tool: "hko_tide_observations",
    input: { station: "bay" },
    request: { url: "https://data.weather.gov.hk/weatherAPI/hko_data/tide/ALL_en.csv" },
    reply: `${BOM}Tide Station,Date,Time,Height(m)\nQuarry Bay,2026-10-18,23:05,2.02\nShek Pik,2026-10-18,23:05,1.96\nWaglan Island,2026-10-18,23:05,----`,
    data: [{ code: "QUB", name: "Quarry Bay", time: "2026-10-18T23:05:00+08:00", heightM: 2.02 }],
    ttl: 120,
  },
  {
    name: "hko_tide_observations reads Chinese names and missing readings",
    tool: "hko_tide_observations",
    input: { lang: "sc", station: "WAG" },
    request: { url: "https://data.weather.gov.hk/weatherAPI/hko_data/tide/ALL_sc.csv" },
    reply: `${BOM}潮汐站,日期,时间,高度（米）\n鰂鱼涌,2026-10-18,23:10,2.02\n横澜岛,2026-10-18,23:10,----`,
    data: [{ code: "WAG", name: "横澜岛", time: "2026-10-18T23:10:00+08:00", heightM: null }],
  },
  {
    tool: "hko_sun_moon",
    input: { date: "2026-10-18", endDate: "2026-10-19" },
    request: { url: "https://data.weather.gov.hk/weatherAPI/opendata/opendata.php?dataType=SRS&year=2026&rformat=json" },
    reply: {
      fields: ["YYYY-MM-DD", "RISE", "TRAN.", "SET"],
      data: [["2026-10-17", "06:20", "12:09", "17:57"], ["2026-10-18", "06:21", "12:09", "17:56"], ["2026-10-19", "06:21", "12:09", "17:55"]],
    },
    lookups: {
      "https://data.weather.gov.hk/weatherAPI/opendata/opendata.php?dataType=MRS&year=2026&rformat=json": {
        fields: ["YYYY-MM-DD", "RISE", "TRAN.", "SET"],
        data: [["2026-10-18", "12:48", "18:14", "23:43"], ["2026-10-19", "13:38", "19:05", ""]],
      },
    },
    data: {
      timeZone: "Asia/Hong_Kong",
      days: [
        { date: "2026-10-18", sunrise: "06:21", sunTransit: "12:09", sunset: "17:56", moonrise: "12:48", moonTransit: "18:14", moonset: "23:43" },
        { date: "2026-10-19", sunrise: "06:21", sunTransit: "12:09", sunset: "17:55", moonrise: "13:38", moonTransit: "19:05", moonset: null },
      ],
    },
    ttl: 86400,
  },
  {
    name: "hko_sun_moon rejects a range that ends before it starts",
    tool: "hko_sun_moon",
    input: { date: "2026-10-18", endDate: "2026-10-01" },
    error: /endDate/,
  },

  // hko-weather
  {
    tool: "hko_current_weather",
    input: {},
    request: { url: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en" },
    reply: { temperature: { data: [{ place: "King's Park", value: 27 }] }, humidity: { data: [] }, updateTime: "2026-10-18T10:02:00+08:00", lightning: {} },
    data: { temperature: { data: [{ place: "King's Park", value: 27 }] }, humidity: { data: [] }, updateTime: "2026-10-18T10:02:00+08:00" },
    ttl: 300,
  },
  {
    tool: "hko_local_forecast",
    input: { lang: "tc" },
    request: { url: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=flw&lang=tc" },
    reply: { generalSituation: "天氣晴朗", forecastPeriod: "今日" },
    data: { generalSituation: "天氣晴朗", forecastPeriod: "今日" },
  },
  {
    tool: "hko_nine_day_forecast",
    input: { lang: "sc" },
    request: { url: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=fnd&lang=sc" },
    reply: { weatherForecast: [{ forecastDate: "20261019" }] },
    data: { weatherForecast: [{ forecastDate: "20261019" }] },
  },
  {
    tool: "hko_warning_summary",
    input: {},
    request: { url: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=en" },
    reply: {},
    data: {},
  },
  {
    tool: "hko_warning_details",
    input: {},
    request: { url: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warningInfo&lang=en" },
    reply: { details: [{ warningStatementCode: "WHOT", contents: ["Very Hot Weather Warning"] }] },
    data: { details: [{ warningStatementCode: "WHOT", contents: ["Very Hot Weather Warning"] }] },
  },
  {
    tool: "hko_special_weather_tips",
    input: {},
    request: { url: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=swt&lang=en" },
    reply: { swt: [] },
    data: { swt: [] },
  },
  {
    tool: "hko_earthquake",
    input: { kind: "feltearthquake" },
    request: { url: "https://data.weather.gov.hk/weatherAPI/opendata/earthquake.php?dataType=feltearthquake&lang=en" },
    reply: { mag: 3.1, region: "Guangdong" },
    data: { mag: 3.1, region: "Guangdong" },
  },
  {
    tool: "hko_lunar_date",
    input: { date: "2026-02-17" },
    request: { url: "https://data.weather.gov.hk/weatherAPI/opendata/lunardate.php?date=2026-02-17" },
    reply: { LunarYear: "丙午年，馬", LunarDate: "正月初一" },
    data: { LunarYear: "丙午年，馬", LunarDate: "正月初一" },
    ttl: 86400,
  },
  {
    name: "hko_lunar_date rejects a malformed date",
    tool: "hko_lunar_date",
    input: { date: "17/02/2026" },
    error: /date/,
  },

  // kmb
  {
    tool: "kmb_routes",
    input: { route: "1a" },
    request: { url: "https://data.etabus.gov.hk/v1/transport/kmb/route/" },
    reply: { data: [{ route: "1A", bound: "O", orig_en: "STAR FERRY" }, { route: "1A", bound: "I", orig_en: "SAU MAU PING" }, { route: "2", bound: "O", orig_en: "STAR FERRY" }] },
    data: [{ route: "1A", bound: "O", orig_en: "STAR FERRY" }, { route: "1A", bound: "I", orig_en: "SAU MAU PING" }],
    meta: { total: 2, returned: 2, truncated: false },
    ttl: 3600,
  },
  {
    tool: "kmb_stops",
    input: { search: "旺角" },
    request: { url: "https://data.etabus.gov.hk/v1/transport/kmb/stop" },
    reply: { data: [{ stop: "A1", name_en: "MONG KOK STATION", name_tc: "旺角站" }, { stop: "B2", name_en: "JORDAN", name_tc: "佐敦" }] },
    data: [{ stop: "A1", name_en: "MONG KOK STATION", name_tc: "旺角站" }],
  },
  {
    name: "kmb_stops needs a search term",
    tool: "kmb_stops",
    input: {},
    error: /search/,
  },
  {
    tool: "kmb_stop",
    input: { stopId: "18492910339410B1" },
    request: { url: "https://data.etabus.gov.hk/v1/transport/kmb/stop/18492910339410B1" },
    reply: { data: { stop: "18492910339410B1", name_en: "CHUK YUEN ESTATE BUS TERMINUS" } },
    data: { stop: "18492910339410B1", name_en: "CHUK YUEN ESTATE BUS TERMINUS" },
  },
  {
    tool: "kmb_route_stops",
    input: { route: "1a", direction: "inbound" },
    request: { url: "https://data.etabus.gov.hk/v1/transport/kmb/route-stop/1A/inbound/1" },
    reply: { data: [{ route: "1A", bound: "I", seq: "1", stop: "A1" }, { route: "1A", bound: "I", seq: "2", stop: "UNKNOWN" }] },
    lookups: {
      "https://data.etabus.gov.hk/v1/transport/kmb/stop": {
        data: [{ stop: "A1", name_en: "STAR FERRY", name_tc: "尖沙咀碼頭", name_sc: "尖沙咀码头", lat: "22.29", long: "114.16" }],
      },
    },
    // Stops missing from the stop list keep just their id.
    data: [
      { route: "1A", bound: "I", seq: "1", stop: "A1", name_en: "STAR FERRY", name_tc: "尖沙咀碼頭", name_sc: "尖沙咀码头", lat: "22.29", long: "114.16" },
      { route: "1A", bound: "I", seq: "2", stop: "UNKNOWN" },
    ],
  },
  {
    tool: "kmb_stop_eta",
    input: { stopId: "18492910339410B1", route: "1a" },
    request: { url: "https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/18492910339410B1" },
    reply: {
      data: [
        { co: "KMB", route: "1A", dir: "O", service_type: 1, seq: 1, eta_seq: 1, eta: "2026-10-18T10:05:00+08:00" },
        { co: "KMB", route: "2", dir: "O", service_type: 1, seq: 4, eta_seq: 1, eta: "2026-10-18T10:07:00+08:00" },
      ],
    },
    data: [{ route: "1A", dir: "O", service_type: 1, seq: 1, eta_seq: 1, eta: "2026-10-18T10:05:00+08:00" }],
    ttl: 30,
  },
  {
    tool: "kmb_route_eta",
    input: { route: "1a" },
    request: { url: "https://data.etabus.gov.hk/v1/transport/kmb/route-eta/1A/1" },
    reply: { data: [{ co: "KMB", route: "1A", dir: "O", seq: 1, eta_seq: 1, eta: null, rmk_en: "Scheduled Bus" }] },
    data: [{ dir: "O", seq: 1, eta_seq: 1, eta: null, rmk_en: "Scheduled Bus" }],
  },

  // mtr
  {
    tool: "mtr_next_train",
    input: { line: "tml", sta: "tum", lang: "sc" },
    request: { url: "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=TML&sta=TUM&lang=TC" },
    reply: { status: 1, data: { "TML-TUM": { UP: [], DOWN: [{ dest: "WKS", ttnt: "3" }] } } },
    data: { status: 1, data: { "TML-TUM": { UP: [], DOWN: [{ dest: "WKS", ttnt: "3" }] } } },
    ttl: 30,
  },
  {
    tool: "mtr_light_rail_schedule",
    input: { stationId: "100" },
    request: { url: "https://rt.data.gov.hk/v1/transport/mtr/lrt/getSchedule?station_id=100" },
    reply: { status: 1, platform_list: [{ platform_id: 1, route_list: [{ route_no: "507", time_en: "2 min" }] }] },
    data: { status: 1, platform_list: [{ platform_id: 1, route_list: [{ route_no: "507", time_en: "2 min" }] }] },
  },
  {
    tool: "mtr_bus_schedule",
    input: { routeName: "k12" },
    request: { url: "https://rt.data.gov.hk/v1/transport/mtr/bus/getSchedule", method: "POST", body: { routeName: "K12", language: "en" } },
    reply: { routeName: "K12", busStop: [{ busStopId: "K12-U010", bus: [] }] },
    data: { routeName: "K12", busStop: [{ busStopId: "K12-U010", bus: [] }] },
  },

  // td-carpark
  {
    tool: "carpark_info",
    input: { search: "mong kok", lang: "tc" },
    request: { url: "https://api.data.gov.hk/v1/carpark-info-vacancy?data=info&vehicleTypes=privateCar&lang=zh_TW" },
    reply: {
      results: [
        { park_Id: "10", name: "旺角停車場", displayAddress: "Mong Kok Road", district: "Yau Tsim Mong", renditionUrls: {} },
        { park_Id: "11", name: "Shatin Park", displayAddress: "Sha Tin Centre St", district: "Sha Tin", renditionUrls: {} },
      ],
    },
    data: [{ park_Id: "10", name: "旺角停車場", displayAddress: "Mong Kok Road", district: "Yau Tsim Mong" }],
  },
  {
    tool: "carpark_vacancy",
    input: { parkId: "11", vehicleTypes: "motorCycle" },
    request: { url: "https://api.data.gov.hk/v1/carpark-info-vacancy?data=vacancy&vehicleTypes=motorCycle&lang=en_US" },
    reply: { results: [{ park_Id: "10", motorCycle: [{ vacancy: 3 }] }, { park_Id: "11", motorCycle: [{ vacancy: 0 }] }] },
    data: [{ park_Id: "11", motorCycle: [{ vacancy: 0 }] }],
    ttl: 60,
  },
];

const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
let cache = memoryCache();

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
  await db.insert(datasets).values([
    {
      id: "hk-hko-rss-current-weather-report",
      titleEn: "Current Weather Report",
      titleTc: "本港地區天氣報告",
      organization: "hk-hko",
      organizationTitle: "Hong Kong Observatory",
      groups: ["climate-and-weather"],
      formats: ["JSON"],
      isApi: true,
      url: "https://data.gov.hk/en-data/dataset/hk-hko-rss-current-weather-report",
    },
    { id: "hk-hko-weather-archive", titleEn: "Weather archive", organization: "hk-hko", groups: ["climate-and-weather"], formats: ["CSV"], isApi: false },
    { id: "hk-td-parking", titleEn: "Parking meters", organization: "hk-td", groups: ["transport"], formats: ["CSV"], isApi: true },
    { id: "hk-td-weather-roads", titleEn: "Removed weather roads", organization: "hk-td", groups: ["transport"], isApi: true, removedAt: new Date() },
  ]);
});

beforeEach(() => {
  cache = memoryCache();
  setCacheForTesting(cache);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  setCacheForTesting(null);
});

describe("MCP tools", () => {
  it("has a test case for every generated tool", () => {
    const tested = new Set(cases.map((testCase) => testCase.tool));
    expect([...toolsByName.keys()].filter((name) => !tested.has(name))).toEqual([]);
  });

  it.each(cases.map((testCase) => [testCase.name ?? testCase.tool, testCase] as const))("%s", async (_name, testCase) => {
    const { service, tool } = find(testCase.tool);
    fetchMock.mockImplementation(async (url) => {
      if (testCase.lookups && url in testCase.lookups) {
        const lookup = testCase.lookups[url];
        return new Response(typeof lookup === "string" ? lookup : JSON.stringify(lookup));
      }
      if (!testCase.request || url !== testCase.request.url) throw new Error(`Unexpected upstream request: ${url}`);
      return new Response(typeof testCase.reply === "string" ? testCase.reply : JSON.stringify(testCase.reply));
    });

    if (testCase.error) {
      await expect(executeTool(service, tool, testCase.input)).rejects.toThrow(testCase.error);
      expect(fetchMock).not.toHaveBeenCalled();
      return;
    }

    const result = await executeTool(service, tool, testCase.input);

    if (testCase.request) {
      expect(fetchMock).toHaveBeenCalledTimes(1 + Object.keys(testCase.lookups ?? {}).length);
      const [, init] = fetchMock.mock.calls[0];
      expect(init.method).toBe(testCase.request.method ?? "GET");
      expect(init.body === undefined ? undefined : JSON.parse(String(init.body))).toEqual(testCase.request.body);
      if (!tool.handler) expect(result.meta.source).toBe(testCase.request.url);
    } else {
      expect(fetchMock).toHaveBeenCalledTimes(Object.keys(testCase.lookups ?? {}).length);
    }
    expect(result.data).toEqual(testCase.data);
    if (testCase.meta) expect(result.meta).toMatchObject(testCase.meta);
    if (testCase.ttl !== undefined) expect(cache.set).toHaveBeenCalledWith(expect.any(String), expect.anything(), expect.objectContaining({ ttl: testCase.ttl }));
  });
});

describe("MCP tool upstream behaviour", () => {
  it("only reads resources the dataset publishes", async () => {
    const { service, tool } = find("datagovhk_get_resource");
    const resources = [{ id: "r1", name: "Info", format: "JSON", url: "https://td.test/info.json" }, { id: "r2", name: "Sheet", format: "XLSX", url: "https://td.test/a.xlsx" }];
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ result: { resources } })));
    await expect(executeTool(service, tool, { dataset: "hk-td-a", resource: "https://evil.test/x" })).rejects.toThrow(/no resource .*Info, Sheet/);
    await expect(executeTool(service, tool, { dataset: "hk-td-a", resource: "r2" })).rejects.toThrow(/XLSX/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves a repeated call from the cache", async () => {
    const { service, tool } = find("kmb_stop");
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ data: { stop: "X" } })));
    await executeTool(service, tool, { stopId: "X" });
    await executeTool(service, tool, { stopId: "X" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends JSON with the router's User-Agent", async () => {
    const { service, tool } = find("mtr_bus_schedule");
    fetchMock.mockImplementation(async () => new Response("{}"));
    await executeTool(service, tool, { routeName: "506" });
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers).toMatchObject({ Accept: "application/json", "Content-Type": "application/json", "User-Agent": expect.stringMatching(/^mcprouter\//) });
  });

  it("reports an upstream HTTP error with its status", async () => {
    const { service, tool } = find("hko_current_weather");
    fetchMock.mockImplementation(async () => new Response("maintenance", { status: 502 }));
    await expect(executeTool(service, tool, {})).rejects.toMatchObject({ code: "upstream_http", status: 502, message: expect.stringMatching(/502: maintenance/) });
  });

  it("reports an upstream reply that is not valid JSON", async () => {
    const { service, tool } = find("kmb_stop");
    fetchMock.mockImplementation(async () => new Response("<html>oops</html>"));
    await expect(executeTool(service, tool, { stopId: "Y" })).rejects.toMatchObject({ code: "upstream_parse" });
  });

  it("reports an unreachable upstream", async () => {
    const { service, tool } = find("citybus_stop");
    fetchMock.mockImplementation(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(executeTool(service, tool, { stopId: "001313" })).rejects.toMatchObject({ code: "upstream_network" });
  });

  it("reports an upstream timeout", async () => {
    const { service, tool } = find("citybus_stop");
    fetchMock.mockImplementation(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    await expect(executeTool(service, tool, { stopId: "001314" })).rejects.toMatchObject({ code: "upstream_timeout" });
  });

  it("does not cache a failed upstream call", async () => {
    const { service, tool } = find("kmb_stop");
    fetchMock.mockImplementationOnce(async () => new Response("busy", { status: 503 }));
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ data: { stop: "Z" } })));
    await expect(executeTool(service, tool, { stopId: "Z" })).rejects.toThrow();
    expect((await executeTool(service, tool, { stopId: "Z" })).data).toEqual({ stop: "Z" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
