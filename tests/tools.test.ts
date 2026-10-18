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
