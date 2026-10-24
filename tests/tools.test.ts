import { cases079 } from "./batch079-cases";
import { commerceCases } from "./commerce-cases";
import { cases053 } from "./batch053-cases";
import { cases051 } from "./batch051-cases";
import type { Case } from "./tool-case";
import { cases027 } from "./health027-cases";
import { cases025 } from "./health025-cases";
import { toolCases024 } from "./environment024-cases";
import { spatialCases023, fileCases023 } from "./environment023-cases";
import { cases022 } from "./environment022-cases";
import { environmentCases } from "./environment021-cases";
import { governmentCases } from "./finance034-cases";
import { batch035, fixture035, request035 } from "./finance035-cases";
import { marketsCases } from "./finance033-cases";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import { services } from "@/generated/registry";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { executeTool } from "@/lib/mcp/runtime";
import type { ServiceDefinition, ToolDefinition } from "@/lib/mcp/types";
import { transportCases } from "./transport003-cases";
import { financeCases } from "./finance028-cases";
import { expenditureCases } from "./finance029-cases";
import { accountsCases } from "./finance030-cases";
import { investmentCases } from "./finance032-cases";
import { externalCases } from "./finance031-cases";

/**
 * Runs every generated MCP tool against a stubbed upstream: checks the HTTP
 * request it sends (URL, method, body) and how it shapes the reply. Any request
 * the case didn't expect fails the test, so nothing reaches the network.
 */



const BOM = "﻿";

const toolsByName = new Map(services.flatMap((service) => service.tools.flatMap((tool) => (tool.operations ?? [tool]).map((operation) => [operation.name, { service, tool: operation }] as const))));

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

// Trimmed from the Observatory's real files: a list in its published format, and the last track of SURIGAE
// (2641), whose first forecast position has no time (interpolated, only for drawing the line).
const cycloneList = `<?xml version="1.0" encoding="UTF-8"?>
<TropicalCycloneList>
<TropicalCyclone>
<TropicalCycloneID>2641</TropicalCycloneID>
<TropicalCycloneChineseName>舒力基</TropicalCycloneChineseName>
<TropicalCycloneEnglishName>SURIGAE</TropicalCycloneEnglishName>
<TropicalCycloneURL>http://www.weather.gov.hk/wxinfo/currwx/hko_tctrack_2641.xml
</TropicalCycloneURL>
</TropicalCyclone>
</TropicalCycloneList>`;

const cycloneTrack = `<?xml version="1.0" encoding="UTF-8"?>
<TropicalCycloneTrack tcid="2641"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xsi:noNamespaceSchemaLocation="tc_track.xsd">
<BulletinHeader>
<BulletinName>Tropical Cyclone Track</BulletinName>
<BulletinType>R</BulletinType>
<BulletinProvider>Hong Kong Observatory</BulletinProvider>
<BulletinTime>2026-10-01T04:00:47+08:00</BulletinTime>
</BulletinHeader>
<WeatherReport>
<TropicalCycloneName>SURIGAE</TropicalCycloneName>
<PastInformation>
<Index>31</Index>
<Intensity>Tropical Storm</Intensity>
<MaximumWind>65km/h</MaximumWind>
<Time>2026-09-30T06:00:00+00:00</Time>
<Latitude>31.30N</Latitude>
<Longitude>138.40E</Longitude>
</PastInformation>
<PastInformation>
<Index>32</Index>
<Intensity>Tropical Storm</Intensity>
<MaximumWind>65km/h</MaximumWind>
<Time>2026-09-30T12:00:00+00:00</Time>
<Latitude>31.80N</Latitude>
<Longitude>138.90E</Longitude>
</PastInformation>
<AnalysisInformation>
<Intensity>Tropical Storm</Intensity>
<MaximumWind>65km/h</MaximumWind>
<Time>2026-09-30T18:00:00+00:00</Time>
<Latitude>32.20N</Latitude>
<Longitude>139.70E</Longitude>
</AnalysisInformation>
<ForecastInformation>
<Index>11</Index>
<Latitude>34.83N</Latitude>
<Longitude>142.32E</Longitude>
</ForecastInformation>
<ForecastInformation>
<Index>12</Index>
<Intensity>Extratropical Low</Intensity>
<MaximumWind>--</MaximumWind>
<Time>2026-10-01T06:00:00+00:00</Time>
<Latitude>35.00N</Latitude>
<Longitude>142.50E</Longitude>
</ForecastInformation>
</WeatherReport>
</TropicalCycloneTrack>`;

const surigaeNow = { time: "2026-10-01T02:00:00+08:00", category: "tropical_storm", intensity: "Tropical Storm", maximumWindKmh: 65, latitude: 32.2, longitude: 139.7, distanceKm: 2744, bearing: "ENE" };

const METER_SPACES = "https://resource.data.one.gov.hk/td/psiparkingspaces/spaceinfo/parkingspaces.csv";
const METER_OCCUPANCY = "https://resource.data.one.gov.hk/td/psiparkingspaces/occupancystatus/occupancystatus.csv";

/** The metered location file starts with its date and a line of commas; Tuen Mun's newest meters have no Chinese names yet. */
const meterSpaces = [
  `${BOM}2026-10-17`,
  ",,,,,,,,,,,,,,,,,,,,,,,",
  "PoleId,ParkingSpaceId,Region,Region_tc,Region_sc,District,District_tc,District_sc,SubDistrict,SubDistrict_tc,SubDistrict_sc,Street,Street_tc,Street_sc,SectionOfStreet,SectionOfStreet_tc,SectionOfStreet_sc,Latitude,Longitude,VehicleType,LPP,OperatingPeriod,TimeUnit,PaymentUnit",
  "1199,1199A,HONG KONG,香港島,香港岛,WAN CHAI,灣仔,湾仔,TAI FAT HAU,大佛口,大佛口,LOCKHART ROAD,駱克道,骆克道,FENWICK STREET,分域街,分域街,22.27837319738389,114.1693944716486,A,30,D,15,4.00",
  "1199,1199B,HONG KONG,香港島,香港岛,WAN CHAI,灣仔,湾仔,TAI FAT HAU,大佛口,大佛口,LOCKHART ROAD,駱克道,骆克道,FENWICK STREET,分域街,分域街,22.27837797330262,114.1693467203257,A,30,D,15,4.00",
  "1172,1172A,HONG KONG,香港島,香港岛,WAN CHAI,灣仔,湾仔,OI KWAN,愛群,爱群,STEWART ROAD,史釗域道,史钊域道,JAFFE ROAD,謝斐道,谢斐道,22.27934108627336,114.1767267848235,A,30,D,15,4.00",
  "20501,20501A,NEW TERRITORIES,新界,新界,TSUEN WAN,荃灣,荃湾,TING SHAM,汀深,汀深,CASTLE PEAK ROAD - TING KAU,青山公路 － 汀九段,青山公路 － 汀九段,TING KAU BEACH,汀九泳灘,汀九泳滩,22.363715,114.0681147,G,120,4Q,15,2.00",
  "22259,22259A,NEW TERRITORIES,,,TUEN MUN,,,SAN HUI,,,HANG FU STREET,,,NERINE COVE BLOCK#5,,,22.3832641,113.9714256,A,120,Q,15,4.00",
  "90004,90004A,KOWLOON,九龍,九龙,INTERNAL TEST,內部測試,内部测试,CONTRACT 2,合約 2,合约 2,LAI CHI KOK ENGINEERING CENTER,電訊盈科荔枝角工程中心,电讯盈科荔枝角工程中心,INTERNAL TEST,內部測試,内部测试,48.8505009,2.3024468,A,30,Z,5,0.20",
].join("\r\n");

const meterOccupancy = [
  "ParkingSpaceId,ParkingMeterStatus,OccupancyStatus,OccupancyDateChanged",
  "1199A,N,V,10/18/2026 09:49:07 PM",
  "1199B,N,O,10/18/2026 12:15:38 PM",
  "1172A,NU,O,10/05/2026 03:34:46 PM",
  "20501A,N,V,10/18/2026 08:01:11 AM",
  "90004A,N,V,10/18/2026 10:00:00 PM",
].join("\r\n");

const SENSOR_SPACES = "https://data.nmospiot.gov.hk/api/pvds/Download/parkingspace";
const SENSOR_OCCUPANCY = "https://data.nmospiot.gov.hk/api/pvds/Download/occupancystatus";

/** The header names a NonMetered column that no row fills. */
const sensorSpaces = [
  `${BOM}2026-10-18`,
  "",
  "FeatureID,ParkingSpaceId,Region,Region_tc,Region_sc,District,District_tc,District_sc,SubDistrict,SubDistrict_tc,SubDistrict_sc,Street,Street_tc,Street_sc,SectionOfStreet,SectionOfStreet_tc,SectionOfStreet_sc,Latitude,Longitude,VehicleType,NonMetered",
  "2065,A101_CL_001,New Territories,新界,新界,North District,北區,北区,Wu Kau Tang,烏蛟騰,乌蛟腾,Bride’s Pool Road,新娘潭路,新娘潭路,Bride’s Pool Road (near Bride’s Pool ex-Bus Terminus),新娘潭路（近新娘潭前巴士總站）,新娘潭路（近新娘潭前巴士总站）,22.502228,114.237742,A",
  "2064,A101_CL_002,New Territories,新界,新界,North District,北區,北区,Wu Kau Tang,烏蛟騰,乌蛟腾,Bride’s Pool Road,新娘潭路,新娘潭路,Bride’s Pool Road (near Bride’s Pool ex-Bus Terminus),新娘潭路（近新娘潭前巴士總站）,新娘潭路（近新娘潭前巴士总站）,22.502226,114.237713,A",
  "2068,A101_BC_013,New Territories,新界,新界,North District,北區,北区,Wu Kau Tang,烏蛟騰,乌蛟腾,Bride’s Pool Road,新娘潭路,新娘潭路,Bride’s Pool Road (near Bride’s Pool ex-Bus Terminus),新娘潭路（近新娘潭前巴士總站）,新娘潭路（近新娘潭前巴士总站）,22.502201,114.237398,C",
  "5136,A115_DR_017,New Territories,新界,新界,Sha Tin District,沙田區,沙田区,Ma On Shan,馬鞍山,马鞍山,Hang Shun Street,恆信街,恆信街,Hang Shun Street,恆信街,恆信街,22.407261,114.223089,D",
].join("\n");

const sensorOccupancy = [
  "FeatureID,ParkingSpaceId,OccupancyStatus,OccupancyDateChanged",
  "2065,A101_CL_001,NU,2/7/2026 9:9:40",
  "2064,A101_CL_002,NU,22/5/2026 22:34:38",
  "2068,A101_BC_013,NU,19/9/2025 15:16:27",
  "5136,A115_DR_017,V,18/10/2026 19:34:48",
].join("\n");

const cases: Case[] = [
  ...cases079,
  ...cases053,
  ...cases027.map((c) => ({ ...c, name: c.file, ttl: 3600, data: expect.objectContaining({ returned: 2, hasMore: true, nextOffset: 2 }) })),
  ...cases025.map((c) => ({ ...c, name: c.file + c.input.lang, ttl: 3600, data: expect.objectContaining({ returned: 2, hasMore: true, nextOffset: 2 }) })),
  ...toolCases024,
  ...spatialCases023.map((c) => ({ ...c, name: c.file, ttl: 3600 })),
  ...fileCases023.map((c) => ({ ...c, name: c.file + c.lang, ttl: c.kind === "clothes" ? 3600 : 300,
    data: expect.objectContaining({ returned: 2, source: c.request.url, hasMore: true, nextOffset: 2 }) })),
  ...cases022.map((c) => ({ ...c, name: c.file, ttl: 3600 })),
  ...environmentCases,
  ...transportCases,
  ...financeCases,
  ...expenditureCases,
  ...accountsCases,
  ...externalCases,
  ...investmentCases,
  ...marketsCases,
  ...governmentCases,
  ...cases051,
  ...commerceCases,
  ...batch035.map((c) => ({ tool: c.tool, input: { ...c.input, limit: 3 },
    request: { url: request035(c.tool) }, reply: fixture035(c.fixture), ttl: 3600,
    data: expect.objectContaining({ results: expect.any(Array), returned: expect.any(Number) }) })),
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

  // hk-airport
  {
    tool: "airport_departures",
    input: { date: "2026-10-18", airline: "cx", airport: "nrt" },
    request: { url: "https://www.hongkongairport.com/flightinfo-rest/rest/flights/past?arrival=false&date=2026-10-18&cargo=false&lang=en" },
    reply: [
      {
        date: "2026-10-17",
        arrival: false,
        cargo: false,
        list: [{ time: "22:30", flight: [{ no: "UA 878D", airline: "UAL" }], status: "Dep 10:47 (18/10/2026)", statusCode: null, destination: ["SFO"], terminal: "T1", aisle: "G", gate: "66" }],
        lastUpdatedTime: "2026-10-18T21:27:14+08:00",
      },
      {
        date: "2026-10-18",
        arrival: false,
        cargo: false,
        list: [
          { time: "01:20", flight: [{ no: "CX 524", airline: "CPA" }, { no: "JL 7040", airline: "JAL" }], status: "Dep 01:40", statusCode: null, destination: ["NRT"], terminal: "T1", aisle: "C", gate: "25" },
          { time: "08:15", flight: [{ no: "JL 7026", airline: "JAL" }], status: "Dep 08:30", statusCode: null, destination: ["NRT"], terminal: "T1", aisle: "D", gate: "35" },
          { time: "23:55", flight: [{ no: "UO 848", airline: "HKE" }, { no: "CX 5848", airline: "CPA" }], status: "", statusCode: null, destination: ["NRT"], terminal: "T1", aisle: "", gate: "" },
          { time: "23:59", flight: [{ no: "CX 254", airline: "CPA" }], status: "Boarding Soon", statusCode: null, destination: ["LHR"], terminal: "T1", aisle: "B", gate: "3" },
        ],
        lastUpdatedTime: "2026-10-18T21:27:14+08:00",
      },
    ],
    data: [
      {
        scheduled: "2026-10-18T01:20+08:00",
        flight: "CX 524",
        airline: "CPA",
        codeshares: ["JL 7040"],
        destinations: ["NRT"],
        status: "Dep 01:40",
        state: "departed",
        statusTime: "2026-10-18T01:40+08:00",
        terminal: "T1",
        aisle: "C",
        gate: "25",
      },
      { scheduled: "2026-10-18T23:55+08:00", flight: "UO 848", airline: "HKE", codeshares: ["CX 5848"], destinations: ["NRT"], status: null, state: "scheduled", terminal: "T1" },
    ],
    meta: { total: 2, returned: 2, truncated: false },
    ttl: 120,
  },
  {
    name: "airport_departures reads cargo flights in Chinese within a time window",
    tool: "airport_departures",
    input: { date: "2026-10-18", cargo: true, lang: "tc", from: "07:30", to: "08:00", status: "departed" },
    request: { url: "https://www.hongkongairport.com/flightinfo-rest/rest/flights/past?arrival=false&date=2026-10-18&cargo=true&lang=zh_HK" },
    reply: [
      {
        date: "2026-10-18",
        arrival: false,
        cargo: true,
        list: [
          { time: "07:25", flight: [{ no: "HJ 024", airline: "TMN" }], status: "啟航 07:23", statusCode: null, destination: ["SYD"] },
          { time: "07:35", flight: [{ no: "3S 721", airline: "BOX" }], status: "啟航 07:48", statusCode: null, destination: ["DEL", "LEJ"] },
          { time: "07:40", flight: [{ no: "5X 003", airline: "UPS" }], status: "取消", statusCode: null, destination: ["BLR", "CGN", "PHL"] },
        ],
        lastUpdatedTime: "2026-10-18T23:09:22+08:00",
      },
    ],
    data: [{ scheduled: "2026-10-18T07:35+08:00", flight: "3S 721", airline: "BOX", destinations: ["DEL", "LEJ"], status: "啟航 07:48", state: "departed", statusTime: "2026-10-18T07:48+08:00" }],
  },
  {
    tool: "airport_arrivals",
    input: { date: "2026-10-18", flight: "qf8228" },
    request: { url: "https://www.hongkongairport.com/flightinfo-rest/rest/flights/past?arrival=true&date=2026-10-18&cargo=false&lang=en" },
    reply: [
      {
        date: "2026-10-18",
        arrival: true,
        cargo: false,
        list: [
          { time: "10:45", flight: [{ no: "CX 305", airline: "CPA" }], status: "At gate 10:18", statusCode: null, origin: ["NKG"], baggage: "3", hall: "A", terminal: "", stand: "R17" },
          {
            time: "10:50",
            flight: [{ no: "CX 413", airline: "CPA" }, { no: "QF 8228", airline: "QFA" }, { no: "QR 3488", airline: "QTR" }],
            status: "At gate 10:19",
            statusCode: null,
            origin: ["ICN"],
            baggage: "10",
            hall: "A",
            terminal: "",
            stand: "S11",
          },
        ],
        lastUpdatedTime: "2026-10-18T21:53:01+08:00",
      },
      {
        date: "2026-10-19",
        arrival: true,
        cargo: false,
        list: [{ time: "00:05", flight: [{ no: "QF 8228", airline: "QFA" }], status: "Est at 23:21 (18/10/2026)", statusCode: null, origin: ["DPS"], baggage: "5", hall: "A", terminal: "", stand: "" }],
        lastUpdatedTime: "2026-10-18T21:53:01+08:00",
      },
    ],
    data: [
      {
        scheduled: "2026-10-18T10:50+08:00",
        flight: "CX 413",
        airline: "CPA",
        codeshares: ["QF 8228", "QR 3488"],
        origins: ["ICN"],
        status: "At gate 10:19",
        state: "at_gate",
        statusTime: "2026-10-18T10:19+08:00",
        baggageBelt: "10",
        hall: "A",
        stand: "S11",
      },
      { scheduled: "2026-10-19T00:05+08:00", flight: "QF 8228", airline: "QFA", origins: ["DPS"], status: "Est at 23:21 (18/10/2026)", state: "estimated", statusTime: "2026-10-18T23:21+08:00", baggageBelt: "5", hall: "A" },
    ],
    ttl: 120,
  },
  {
    name: "airport_arrivals finds landed flights from one airport in Simplified Chinese",
    tool: "airport_arrivals",
    input: { date: "2026-10-18", lang: "sc", airport: "pvg", status: "landed" },
    request: { url: "https://www.hongkongairport.com/flightinfo-rest/rest/flights/past?arrival=true&date=2026-10-18&cargo=false&lang=zh_CN" },
    reply: [
      {
        date: "2026-10-18",
        arrival: true,
        cargo: false,
        list: [
          { time: "21:40", flight: [{ no: "HO 1307", airline: "DKH" }, { no: "MU 3953", airline: "CES" }], status: "着陆於 21:44", statusCode: null, origin: ["PVG"], baggage: "9", hall: "A", terminal: "", stand: "R13" },
          { time: "21:45", flight: [{ no: "CX 369", airline: "CPA" }], status: "到闸口 21:30", statusCode: null, origin: ["PVG"], baggage: "7", hall: "B", terminal: "", stand: "N61" },
          { time: "21:50", flight: [{ no: "CX 383", airline: "CPA" }], status: "着陆於 21:48", statusCode: null, origin: ["PEK"], baggage: "8", hall: "B", terminal: "", stand: "N63" },
        ],
        lastUpdatedTime: "2026-10-18T23:10:27+08:00",
      },
    ],
    data: [
      {
        scheduled: "2026-10-18T21:40+08:00",
        flight: "HO 1307",
        airline: "DKH",
        codeshares: ["MU 3953"],
        origins: ["PVG"],
        status: "着陆於 21:44",
        state: "landed",
        statusTime: "2026-10-18T21:44+08:00",
        baggageBelt: "9",
        hall: "A",
        stand: "R13",
      },
    ],
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

  // hk-ferry
  {
    tool: "ferry_routes",
    input: { search: "peng chau" },
    request: { url: "https://www.hkkfeta.com/opendata/route/" },
    reply: {
      type: "Route",
      version: "1.2",
      generated_timestamp: "2026-10-18T23:11:18+08:00",
      data: [
        { route_id: 1, route_name_en: "Central<=>Sok Kwu Wan", route_name_tc: "中環往來索罟灣", route_name_sc: "中环往来索罟湾", origin_en: "Central", origin_tc: "中環", origin_sc: "中环", destination_en: "Sok Kwu Wan", destination_tc: "索罟灣", destination_sc: "索罟湾" },
        { route_id: 3, route_name_en: "Central<=>Peng Chau", route_name_tc: "中環往來坪洲", route_name_sc: "中环往来坪洲", origin_en: "Central", origin_tc: "中環", origin_sc: "中环", destination_en: "Peng Chau", destination_tc: "坪洲", destination_sc: "坪洲" },
      ],
    },
    data: {
      routes: [
        { operator: "sunferry", operatorName: "Sun Ferry", route: "IIPECMUW", direction: null, from: "Peng Chau", to: "Mui Wo", service: "Inter-islands" },
        { operator: "sunferry", operatorName: "Sun Ferry", route: "IIMUWPEC", direction: null, from: "Mui Wo", to: "Peng Chau", service: "Inter-islands" },
        { operator: "hkkf", operatorName: "Hong Kong & Kowloon Ferry", route: "3", direction: "outbound", from: "Central", to: "Peng Chau", fromPier: "Central Pier 6", toPier: "Peng Chau Pier" },
        { operator: "hkkf", operatorName: "Hong Kong & Kowloon Ferry", route: "3", direction: "inbound", from: "Peng Chau", to: "Central", fromPier: "Peng Chau Pier", toPier: "Central Pier 6" },
      ],
    },
    ttl: 86400,
  },
  {
    name: "ferry_routes lists Sun Ferry routes without calling out, matching Chinese names",
    tool: "ferry_routes",
    input: { operator: "sunferry", search: "長洲", lang: "tc" },
    data: {
      routes: [
        { operator: "sunferry", operatorName: "新渡輪", route: "CECC", direction: null, from: "中環", to: "長洲" },
        { operator: "sunferry", operatorName: "新渡輪", route: "CCCE", direction: null, from: "長洲", to: "中環" },
        { operator: "sunferry", operatorName: "新渡輪", route: "IICMWCHC", direction: null, from: "芝麻灣", to: "長洲", service: "橫水渡" },
        { operator: "sunferry", operatorName: "新渡輪", route: "IICHCCMW", direction: null, from: "長洲", to: "芝麻灣", service: "橫水渡" },
        { operator: "sunferry", operatorName: "新渡輪", route: "IICHCMUW", direction: null, from: "長洲", to: "梅窩", service: "橫水渡" },
        { operator: "sunferry", operatorName: "新渡輪", route: "IIMUWCHC", direction: null, from: "梅窩", to: "長洲", service: "橫水渡" },
      ],
    },
  },
  {
    tool: "ferry_arrivals",
    input: { route: "cecc" },
    request: { url: "https://www.sunferry.com.hk/eta/?route=CECC" },
    reply: {
      type: "ETA",
      version: "1.1",
      generated_timestamp: "2026-10-19T00:05:08+08:00",
      data: [
        { routecode: "CECC", route_en: "Central - Cheung Chau", route_tc: "中環 - 長洲", route_sc: "中环 - 长洲", vesselcode: "GUO", depart_time: "23:30", eta: "00:23", lat: "22.235283", lng: "114.039983", rmk_en: null, rmk_tc: null, rmk_sc: null, date_timestamp: "2026-10-19T00:05:08+08:00" },
        { routecode: "CECCH", route_en: "Central - Cheung Chau", route_tc: "中環 - 長洲", route_sc: "中环 - 长洲", vesselcode: "XMZ11", depart_time: "23:45", eta: "00:20", lat: null, lng: null, rmk_en: "Delayed", rmk_tc: null, rmk_sc: null, date_timestamp: "2026-10-19T00:05:08+08:00" },
      ],
    },
    data: {
      operator: "Sun Ferry",
      route: "CECC",
      name: "Central – Cheung Chau",
      updatedAt: "2026-10-19T00:05:08+08:00",
      sailings: [
        { direction: null, from: "Central", to: "Cheung Chau", departure: "2026-10-18T23:30:00+08:00", eta: "2026-10-19T00:23:00+08:00", status: "departed", fast: false, vessel: "GUO", position: { lat: 22.235283, lng: 114.039983 } },
        // Just after midnight: sailings that left before it are dated yesterday, their ETAs today.
        { direction: null, from: "Central", to: "Cheung Chau", departure: "2026-10-18T23:45:00+08:00", eta: "2026-10-19T00:20:00+08:00", status: "departed", fast: true, vessel: "XMZ11", remark: "Delayed" },
      ],
    },
    ttl: 60,
  },
  {
    name: "ferry_arrivals dates a Sun Ferry sailing not yet left to the next morning",
    tool: "ferry_arrivals",
    input: { route: "NPHH", lang: "tc" },
    request: { url: "https://www.sunferry.com.hk/eta/?route=NPHH" },
    reply: {
      type: "ETA",
      version: "1.1",
      generated_timestamp: "2026-10-18T23:10:08+08:00",
      data: [{ routecode: "NPHH", route_en: "North Point - Hung Hom", route_tc: "北角 - 紅磡", route_sc: "北角 - 红磡", vesselcode: "SW11", depart_time: "08:23", lat: null, lng: null, eta: null, rmk_en: null, rmk_tc: null, rmk_sc: null, date_timestamp: "2026-10-18T23:10:08+08:00" }],
    },
    data: {
      operator: "新渡輪",
      route: "NPHH",
      name: "北角 – 紅磡",
      updatedAt: "2026-10-18T23:10:08+08:00",
      sailings: [{ direction: null, from: "北角", to: "紅磡", departure: "2026-10-19T08:23:00+08:00", eta: null, status: "scheduled", fast: false, vessel: "SW11" }],
    },
  },
  {
    name: "ferry_arrivals reads both directions of an HKKF route",
    tool: "ferry_arrivals",
    input: { route: "3" },
    request: { url: "https://www.hkkfeta.com/opendata/eta/3/outbound" },
    reply: { type: "ETA", version: "1.2", generated_timestamp: "2026-10-18T23:11:41+08:00", data: [{ route_id: 3, direction: "outbound", date: "2026-10-18", session_time: "22:50:00", ETA: "2026-10-18T23:16:00+08:00" }] },
    lookups: {
      "https://www.hkkfeta.com/opendata/eta/3/inbound": { type: "ETA", version: "1.2", generated_timestamp: "2026-10-18T23:11:40+08:00", data: [{ route_id: 3, direction: "inbound", date: "2026-10-18", session_time: "22:45:00", ETA: "2026-10-18T23:20:00+08:00" }] },
      "https://www.hkkfeta.com/opendata/route/": {
        type: "Route",
        data: [{ route_id: 3, route_name_en: "Central<=>Peng Chau", origin_en: "Central", origin_tc: "中環", origin_sc: "中环", destination_en: "Peng Chau", destination_tc: "坪洲", destination_sc: "坪洲" }],
      },
    },
    data: {
      operator: "Hong Kong & Kowloon Ferry",
      route: "3",
      name: "Central ⇄ Peng Chau",
      updatedAt: "2026-10-18T23:11:41+08:00",
      sailings: [
        { direction: "outbound", from: "Central", to: "Peng Chau", fromPier: "Central Pier 6", toPier: "Peng Chau Pier", departure: "2026-10-18T22:50:00+08:00", eta: "2026-10-18T23:16:00+08:00", status: "departed" },
        { direction: "inbound", from: "Peng Chau", to: "Central", fromPier: "Peng Chau Pier", toPier: "Central Pier 6", departure: "2026-10-18T22:45:00+08:00", eta: "2026-10-18T23:20:00+08:00", status: "departed" },
      ],
    },
    ttl: 60,
  },
  {
    name: "ferry_arrivals rejects an unknown Sun Ferry route before calling out",
    tool: "ferry_arrivals",
    input: { route: "CECCX" },
    error: /Unknown Sun Ferry route CECCX. Routes are: CECC, CCCE/,
  },
  {
    tool: "hkkf_timetable",
    input: { route: 3, direction: "inbound" },
    request: { url: "https://www.hkkfeta.com/opendata/time_table/3/inbound" },
    reply: [
      `${BOM}route id/航綫,direction/方向,origin_en,出發碼頭,出发码头,destination_en,目的地碼頭,目的地码头,remarks_en,附註,附注,Monday to Saturday/星期一至星期六,Sunday and Public Holidays/星期日及公眾假期`,
      `3,inbound,Central,中環,中环,Peng Chau,坪洲,坪洲," rgb(0, 0, 0); background-color: rgb(244, 244, 244);"">Remarks:</span><span style=""color: rgb(0, 0, 0);"">^ Last Sailing</span><span style=""color: rgb(0, 0, 0);"">{ } No freight is allowed on this sailing</span><span style=""color: rgb(0, 0, 0);"">▲&nbsp;Only small quantity of freight can be carried</span>",</span><span>^ 尾班船</span>,</span><span>^ 尾班船</span>,"[' { 03:40 }', '    05:30', ' 🞁07:25', ' ^23:30']","['{ 03:40 }', '🞁06:30', '^ 23:35', '']"`,
    ].join("\r\n"),
    data: {
      route: 3,
      direction: "inbound",
      from: "Peng Chau",
      to: "Central",
      mondayToSaturday: [{ time: "03:40", marks: ["{}"] }, { time: "05:30" }, { time: "07:25", marks: ["▲"] }, { time: "23:30", marks: ["^"] }],
      sundayAndHolidays: [{ time: "03:40", marks: ["{}"] }, { time: "06:30", marks: ["▲"] }, { time: "23:35", marks: ["^"] }],
      remarks: [
        { mark: "^", text: "Last Sailing" },
        { mark: "{}", text: "No freight is allowed on this sailing" },
        { mark: "▲", text: "Only small quantity of freight can be carried" },
      ],
    },
    ttl: 86400,
  },
  {
    name: "hkkf_timetable splits Chinese remarks run together without markup",
    tool: "hkkf_timetable",
    input: { route: 1, lang: "tc" },
    request: { url: "https://www.hkkfeta.com/opendata/time_table/1/outbound" },
    reply: [
      `${BOM}route id/航綫,direction/方向,origin_en,出發碼頭,出发码头,destination_en,目的地碼頭,目的地码头,remarks_en,附註,附注,Monday to Saturday/星期一至星期六,Sunday and Public Holidays/星期日及公眾假期`,
      `1,outbound,Central,中環,中环,Sok Kwu Wan,索罟灣,索罟湾,"x"">@ Optional Service</span>",@ 必要時加班服務^ 尾班船及不設載貨服務,@ 必要时加班服务^ 尾班船及不设载货服务,"['07:20', '^23:30', '']","['@12:50', '^23:30']"`,
    ].join("\r\n"),
    data: {
      route: 1,
      direction: "outbound",
      from: "中環",
      to: "索罟灣",
      mondayToSaturday: [{ time: "07:20" }, { time: "23:30", marks: ["^"] }],
      sundayAndHolidays: [{ time: "12:50", marks: ["@"] }, { time: "23:30", marks: ["^"] }],
      remarks: [
        { mark: "@", text: "必要時加班服務" },
        { mark: "^", text: "尾班船及不設載貨服務" },
      ],
    },
  },
  {
    tool: "hkkf_fares",
    input: { route: 1 },
    request: { url: "https://www.hkkfeta.com/opendata/fare_table/1" },
    reply: [
      `${BOM}type/票種,Monday to Saturday/星期一至星期六,Sunday and Public Holidays/星期日及公眾假期`,
      "month_ticket/月票,893",
      "multi-ride_ticket/多程票,--",
      "adult/成人,30.9,43.5",
      "child (aged 3 or above but under 12)/小童(3歲或以上但12歲以下),15.4,21.7",
      "child under 3 (accompanied by adult)/3歲以下小童(須有成人陪同),Free 免費,Free 免費",
    ].join("\r\n"),
    data: [
      { ticket: "month ticket", price: 893 },
      { ticket: "multi-ride ticket", price: null },
      { ticket: "adult", mondayToSaturday: 30.9, sundayAndHolidays: 43.5 },
      { ticket: "child (aged 3 or above but under 12)", mondayToSaturday: 15.4, sundayAndHolidays: 21.7 },
      { ticket: "child under 3 (accompanied by adult)", mondayToSaturday: 0, sundayAndHolidays: 0 },
    ],
    ttl: 86400,
  },
  {
    name: "hkkf_fares names tickets in Chinese",
    tool: "hkkf_fares",
    input: { route: 2, lang: "sc" },
    request: { url: "https://www.hkkfeta.com/opendata/fare_table/2" },
    reply: `${BOM}type/票種,Monday to Saturday/星期一至星期六,Sunday and Public Holidays/星期日及公眾假期\r\nadult/成人,24.9,34.7\r\n`,
    data: [{ ticket: "成人", mondayToSaturday: 24.9, sundayAndHolidays: 34.7 }],
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

  // hko-cyclone
  {
    tool: "hko_tropical_cyclones",
    input: {},
    request: { url: "https://www.weather.gov.hk/wxinfo/currwx/tc_list.xml" },
    reply: cycloneList,
    lookups: { "https://www.weather.gov.hk/wxinfo/currwx/hko_tctrack_2641.xml": cycloneTrack },
    data: {
      cyclones: [
        {
          id: 2641,
          name: "SURIGAE",
          englishName: "SURIGAE",
          chineseName: "舒力基",
          bulletinTime: "2026-10-01T04:00:47+08:00",
          current: surigaeNow,
          closestApproach: { time: "2026-10-01T02:00:00+08:00", distanceKm: 2744, bearing: "ENE" },
          forecastPoints: 1,
        },
      ],
    },
    ttl: 300,
  },
  {
    name: "hko_tropical_cyclones says when no cyclone is tracked",
    tool: "hko_tropical_cyclones",
    input: { lang: "tc" },
    request: { url: "https://www.weather.gov.hk/wxinfo/currwx/tc_list.xml" },
    reply: `<?xml version="1.0" encoding="UTF-8"?>\n<TropicalCycloneList>\n</TropicalCycloneList>`,
    data: { cyclones: [], note: expect.stringMatching(/not tracking any tropical cyclone/) },
  },
  {
    tool: "hko_cyclone_track",
    input: { id: 2641, lang: "sc" },
    request: { url: "https://www.weather.gov.hk/wxinfo/currwx/hko_tctrack_2641.xml" },
    reply: cycloneTrack,
    lookups: { "https://www.weather.gov.hk/wxinfo/currwx/tc_list.xml": cycloneList },
    data: {
      id: 2641,
      name: "舒力基",
      englishName: "SURIGAE",
      chineseName: "舒力基",
      bulletinTime: "2026-10-01T04:00:47+08:00",
      current: { ...surigaeNow, intensity: "热带风暴" },
      closestApproach: { time: "2026-10-01T02:00:00+08:00", distanceKm: 2744, bearing: "ENE" },
      past: [
        { time: "2026-09-30T14:00:00+08:00", category: "tropical_storm", intensity: "热带风暴", maximumWindKmh: 65, latitude: 31.3, longitude: 138.4 },
        { time: "2026-09-30T20:00:00+08:00", category: "tropical_storm", intensity: "热带风暴", maximumWindKmh: 65, latitude: 31.8, longitude: 138.9 },
      ],
      forecast: [
        { time: "2026-10-01T14:00:00+08:00", category: "extratropical_low", intensity: "温带气旋", maximumWindKmh: null, latitude: 35, longitude: 142.5, distanceKm: 3089, bearing: "ENE" },
      ],
    },
    ttl: 300,
  },
  {
    name: "hko_cyclone_track reads the first tracked cyclone without an id",
    tool: "hko_cyclone_track",
    input: {},
    request: { url: "https://www.weather.gov.hk/wxinfo/currwx/tc_list.xml" },
    reply: cycloneList,
    lookups: { "https://www.weather.gov.hk/wxinfo/currwx/hko_tctrack_2641.xml": cycloneTrack },
    data: expect.objectContaining({ id: 2641, name: "SURIGAE", current: surigaeNow, forecast: [expect.objectContaining({ distanceKm: 3089 })] }),
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

  // kowloon-east-parking
  {
    tool: "ke_carparks",
    input: { search: "telford", vehicleType: "privateCar" },
    request: { url: "https://sps-opendata.pilotsmartke.gov.hk/rest/getCarparkInfos?fullload=true&lang=en_US" },
    reply: {
      results: [
        {
          _id: 30,
          name: "Telford Plaza D Carpark",
          nature: "commercial",
          type: "multi-storey",
          address: { region: "KLN", dcDistrict: "Kwun Tong District", subDistrict: "Kowloon Bay", streetName: "33 Wai Yip Street" },
          contactNo: "2997 2262",
          website: "http://www.telford-plaza.com/tch/tp/about_us/parking_info.jsp",
          published: true,
          modifiedDate: "2025-05-27T04:14:21.730Z",
          facilities: ["evCharger"],
          paymentMethods: ["octopus", "visa", "master"],
          heightLimits: [{ remark: "Private Car", height: 1.75 }],
          openingHours: [{ weekdays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN", "PH"], excludePublicHoliday: false, periodEnd: "24:00", periodStart: "00:00" }],
          motorCycle: { spaceUNL: 0, spaceEV: 0, spaceDIS: 0, space: 0 },
          HGV: { spaceUNL: 0, spaceEV: 0, spaceDIS: 0, space: 3, hourlyCharges: [{ weekdays: ["MON"], excludePublicHoliday: false, covered: "covered", type: "hourly", price: 40, periodEnd: "24:00", periodStart: "00:00" }] },
          privateCar: {
            hourlyCharges: [{ weekdays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN", "PH"], excludePublicHoliday: false, covered: "covered", type: "hourly", remark: "", price: 22, periodEnd: "24:00", periodStart: "00:00" }],
            privileges: [{ weekdays: ["MON", "TUE", "WED", "THU", "FRI"], excludePublicHoliday: true, description: "Spend HK$300 for 1-hour\n free parking.", periodEnd: "14:00", periodStart: "12:00" }],
            spaceUNL: 0,
            spaceEV: 2,
            spaceDIS: 0,
            space: 70,
          },
          coordinates: [114.21204329, 22.32228903],
          publishedDate: "2017-02-13T01:41:31.271Z",
          displayAddress: "33 Wai Yip Street, Kowloon Bay, KLN",
        },
        {
          _id: 12,
          name: "Amoy Plaza",
          nature: "commercial",
          type: "multi-storey",
          address: { region: "KLN", dcDistrict: "Kwun Tong District", subDistrict: "Kowloon Bay", streetName: "Ngau Tau Kok Raod" },
          privateCar: { space: 389 },
          coordinates: [114.21675324, 22.32470074],
          displayAddress: "77 Ngau Tau Kok Raod, Kowloon Bay, KLN",
        },
      ],
    },
    data: [
      {
        id: 30,
        name: "Telford Plaza D Carpark",
        nature: "commercial",
        type: "multi-storey",
        address: "33 Wai Yip Street, Kowloon Bay, KLN",
        area: "Kowloon Bay",
        district: "Kwun Tong District",
        latitude: 22.32228903,
        longitude: 114.21204329,
        phone: "2997 2262",
        website: "http://www.telford-plaza.com/tch/tp/about_us/parking_info.jsp",
        openingHours: ["Daily 24 hours"],
        heightLimits: [{ metres: 1.75, remark: "Private Car" }],
        facilities: ["evCharger"],
        paymentMethods: ["octopus", "visa", "master"],
        vehicles: {
          privateCar: {
            spaces: 70,
            evSpaces: 2,
            prices: [{ type: "hourly", price: 22, days: "Daily", hours: "24 hours", covered: "covered" }],
            offers: [{ days: "Mon-Fri except PH", hours: "12:00-14:00", description: "Spend HK$300 for 1-hour free parking." }],
          },
        },
      },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 3600,
  },
  {
    name: "ke_carparks reads one car park in Chinese, with tiered and all-day prices",
    tool: "ke_carparks",
    input: { carparkId: 27, lang: "tc" },
    request: { url: "https://sps-opendata.pilotsmartke.gov.hk/rest/getCarparkInfos?fullload=true&carparkIds=27&lang=zh_TW" },
    reply: {
      results: [
        {
          _id: 27,
          name: "油麗商場停車場",
          nature: "government",
          type: "multi-storey",
          address: { region: "九龍", dcDistrict: "觀塘區", subDistrict: "油塘", streetName: "油塘道9號", buildingName: "油麗商場", floor: "LG1 & LG2" },
          contactNo: "23530667",
          gracePeriods: [{ minutes: 30 }],
          heightLimits: [{ height: 2 }],
          openingHours: [{ weekdays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"], excludePublicHoliday: false, periodStart: "00:00", periodEnd: "00:00" }],
          motorCycle: {
            hourlyCharges: [{ weekdays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"], excludePublicHoliday: false, usageThresholds: [{ hours: 1, price: 2 }], periodStart: "00:00", periodEnd: "24:00", price: 2, usageMinimum: 1, type: "hourly", covered: "covered" }],
            spaceUNL: 0,
            spaceEV: 0,
            spaceDIS: 0,
            space: 2,
          },
          coach: { spaceUNL: 0, spaceEV: 0, spaceDIS: 0, space: 0 },
          privateCar: {
            dayNightParks: [{ weekdays: ["SAT", "SUN", "PH"], excludePublicHoliday: false, periodStart: "23:00", periodEnd: "06:00", price: 13, type: "night-park", covered: "covered", validUntil: "same-day", validUntilEnd: "24:00" }],
            monthlyCharges: [{ reserved: "non-reserved", covered: "covered", type: "monthly-park", remark: "並不適用於充電車位。", price: 3600 }],
            spaceUNL: 0,
            spaceEV: 0,
            spaceDIS: 1,
            space: 11,
          },
          coordinates: [114.23740089, 22.29851205],
          remark: "",
          displayAddress: "九龍油塘油塘道9號油麗商場LG1 & LG2",
        },
      ],
    },
    data: [
      {
        id: 27,
        name: "油麗商場停車場",
        nature: "government",
        type: "multi-storey",
        address: "九龍油塘油塘道9號油麗商場LG1 & LG2",
        area: "油塘",
        district: "觀塘區",
        latitude: 22.29851205,
        longitude: 114.23740089,
        phone: "23530667",
        openingHours: ["Daily 24 hours"],
        heightLimits: [{ metres: 2 }],
        gracePeriods: [{ minutes: 30 }],
        vehicles: {
          privateCar: {
            spaces: 11,
            disabledSpaces: 1,
            prices: [
              { type: "night-park", price: 13, days: "Sat, Sun, PH", hours: "23:00-06:00", covered: "covered", validUntil: "same-day 24:00" },
              { type: "monthly-park", price: 3600, covered: "covered", reserved: "non-reserved", remark: "並不適用於充電車位。" },
            ],
          },
          motorCycle: { spaces: 2, prices: [{ type: "hourly", price: 2, days: "Daily", hours: "24 hours", covered: "covered", minimumHours: 1, firstHours: [{ hours: 1, price: 2 }] }] },
        },
      },
    ],
  },
  {
    name: "ke_carparks reads the empty object upstream sends when nothing matches",
    tool: "ke_carparks",
    input: { carparkId: 999 },
    request: { url: "https://sps-opendata.pilotsmartke.gov.hk/rest/getCarparkInfos?fullload=true&carparkIds=999&lang=en_US" },
    reply: {},
    data: [],
  },
  {
    tool: "ke_parking_vacancy",
    input: { search: "yau tong", vehicleType: "privateCar" },
    request: { url: "https://sps-opendata.pilotsmartke.gov.hk/rest/getCarparkVacancies" },
    reply: {
      results: [
        { _id: 12, closed: false, motorCycle: { vacancy: 0 }, privateCar: { vacancyEV: 1, vacancyDIS: 1, vacancy: 13 }, lastUploadDate: "2026-10-17T10:32:45.420Z", eob: false },
        { _id: 27, closed: false, motorCycle: { vacancy: 2 }, privateCar: { vacancyDIS: 1, vacancy: 4 }, lastUploadDate: "2026-10-18T14:02:20.385Z", eob: false },
        { _id: 38, closed: false, HGV: { vacancy: 35 }, lastUploadDate: "2026-10-18T14:02:17.144Z", eob: false },
      ],
    },
    lookups: {
      "https://sps-opendata.pilotsmartke.gov.hk/rest/getCarparkInfos?fullload=true&lang=en_US": {
        results: [
          { _id: 12, name: "Amoy Plaza", address: { dcDistrict: "Kwun Tong District", subDistrict: "Kowloon Bay" }, privateCar: { space: 389 } },
          { _id: 27, name: "Yau Lai Shopping Centre Carpark", address: { dcDistrict: "Kwun Tong District", subDistrict: "Yau Tong" }, privateCar: { space: 11 }, motorCycle: { space: 2 } },
          { _id: 38, name: "Domain Carpark", address: { dcDistrict: "Kwun Tong District", subDistrict: "Yau Tong" }, HGV: { space: 35 } },
        ],
      },
    },
    data: [
      {
        id: 27,
        name: "Yau Lai Shopping Centre Carpark",
        area: "Yau Tong",
        district: "Kwun Tong District",
        closed: false,
        updatedAt: "2026-10-18T14:02:20.385Z",
        vacancies: { privateCar: { vacant: 4, spaces: 11, disabled: 1 } },
      },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 60,
  },
  {
    name: "ke_parking_vacancy reads one car park in Chinese, and names a car park the list doesn't know",
    tool: "ke_parking_vacancy",
    input: { carparkId: 38, lang: "tc" },
    request: { url: "https://sps-opendata.pilotsmartke.gov.hk/rest/getCarparkVacancies" },
    reply: {
      results: [
        { _id: 12, closed: false, privateCar: { vacancy: 13 }, lastUploadDate: "2026-10-17T10:32:45.420Z" },
        { _id: 38, closed: true, HGV: { vacancy: 35 }, privateCar: { vacancyEV: 0, vacancyDIS: 3, vacancy: 126 }, eob: false },
      ],
    },
    lookups: { "https://sps-opendata.pilotsmartke.gov.hk/rest/getCarparkInfos?fullload=true&lang=zh_TW": { results: [] } },
    data: [
      {
        id: 38,
        name: "Car park 38",
        closed: true,
        updatedAt: null,
        vacancies: { privateCar: { vacant: 126, ev: 0, disabled: 3 }, HGV: { vacant: 35 } },
      },
    ],
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

  // td-street-parking
  {
    tool: "parking_meter_vacancy",
    input: { district: "wan chai" },
    request: { url: METER_SPACES },
    reply: meterSpaces,
    lookups: { [METER_OCCUPANCY]: meterOccupancy },
    data: {
      listDate: "2026-10-17",
      updated: "2026-10-18T21:49:07+08:00",
      total: { spaces: 3, vacant: 1, occupied: 1, notInUse: 1, noData: 0 },
      districts: [{ district: "Wan Chai", spaces: 3, vacant: 1, occupied: 1, notInUse: 1, noData: 0 }],
      streetsMatched: 2,
      streets: [
        {
          district: "Wan Chai",
          street: "Lockhart Road",
          vehicleType: "car",
          spaces: 2,
          vacant: 1,
          occupied: 1,
          notInUse: 0,
          noData: 0,
          hours: ["Mon–Sat 08:00–24:00; Sun and public holidays 10:00–22:00"],
          maxStayMinutes: [30],
          hourlyRate: [16],
          latitude: 22.278378,
          longitude: 114.169347,
        },
        {
          district: "Wan Chai",
          street: "Stewart Road",
          vehicleType: "car",
          spaces: 1,
          vacant: 0,
          occupied: 0,
          notInUse: 1,
          noData: 0,
          hours: ["Mon–Sat 08:00–24:00; Sun and public holidays 10:00–22:00"],
          maxStayMinutes: [30],
          hourlyRate: [16],
          latitude: 22.279341,
          longitude: 114.176727,
        },
      ],
    },
    ttl: 120,
  },
  {
    name: "parking_meter_vacancy counts every district, leaving out test meters",
    tool: "parking_meter_vacancy",
    input: { lang: "tc" },
    request: { url: METER_SPACES },
    reply: meterSpaces,
    lookups: { [METER_OCCUPANCY]: meterOccupancy },
    data: {
      listDate: "2026-10-17",
      updated: "2026-10-18T21:49:07+08:00",
      total: { spaces: 5, vacant: 2, occupied: 1, notInUse: 1, noData: 1 },
      districts: [
        { district: "Tuen Mun", spaces: 1, vacant: 0, occupied: 0, notInUse: 0, noData: 1 },
        { district: "灣仔", spaces: 3, vacant: 1, occupied: 1, notInUse: 1, noData: 0 },
        { district: "荃灣", spaces: 1, vacant: 1, occupied: 0, notInUse: 0, noData: 0 },
      ],
    },
  },
  {
    tool: "parking_meter_spaces",
    input: { street: "lockhart", status: "vacant" },
    request: { url: METER_SPACES },
    reply: meterSpaces,
    lookups: { [METER_OCCUPANCY]: meterOccupancy },
    data: [
      {
        id: "1199A",
        district: "Wan Chai",
        street: "Lockhart Road",
        section: "Fenwick Street",
        vehicleType: "car",
        status: "vacant",
        since: "2026-10-18T21:49:07+08:00",
        latitude: 22.278373,
        longitude: 114.169394,
        maxStayMinutes: 30,
        hourlyRate: 16,
        hours: "Mon–Sat 08:00–24:00; Sun and public holidays 10:00–22:00",
      },
    ],
    ttl: 120,
  },
  {
    name: "parking_meter_spaces finds goods vehicle spaces by a Chinese street name",
    tool: "parking_meter_spaces",
    input: { street: "汀九", vehicleType: "goods", lang: "sc" },
    request: { url: METER_SPACES },
    reply: meterSpaces,
    lookups: { [METER_OCCUPANCY]: meterOccupancy },
    data: [
      {
        id: "20501A",
        district: "荃湾",
        street: "青山公路 － 汀九段",
        section: "汀九泳滩",
        vehicleType: "goods",
        status: "vacant",
        since: "2026-10-18T08:01:11+08:00",
        latitude: 22.363715,
        longitude: 114.068115,
        maxStayMinutes: 120,
        hourlyRate: 8,
        hours: "星期一至六 08:00–20:00；星期日及公众假期 10:00–22:00",
      },
    ],
  },
  {
    tool: "parking_meter_nearby",
    input: { latitude: 22.2784, longitude: 114.1694, radius: 100 },
    request: { url: METER_SPACES },
    reply: meterSpaces,
    lookups: { [METER_OCCUPANCY]: meterOccupancy },
    data: {
      center: { latitude: 22.2784, longitude: 114.1694 },
      radiusMeters: 100,
      updated: "2026-10-18T21:49:07+08:00",
      total: { spaces: 2, vacant: 1, occupied: 1, notInUse: 0, noData: 0 },
      streetsMatched: 1,
      streets: [
        {
          district: "Wan Chai",
          street: "Lockhart Road",
          vehicleType: "car",
          spaces: 2,
          vacant: 1,
          occupied: 1,
          notInUse: 0,
          noData: 0,
          hours: ["Mon–Sat 08:00–24:00; Sun and public holidays 10:00–22:00"],
          maxStayMinutes: [30],
          hourlyRate: [16],
          latitude: 22.278373,
          longitude: 114.169394,
          distanceMeters: 3,
        },
      ],
    },
    ttl: 120,
  },
  {
    tool: "parking_sensor_vacancy",
    input: { search: "Bride's Pool" },
    request: { url: SENSOR_SPACES },
    reply: sensorSpaces,
    lookups: { [SENSOR_OCCUPANCY]: sensorOccupancy },
    data: {
      listDate: "2026-10-18",
      total: { spaces: 3, vacant: 0, occupied: 0, notInUse: 3, noData: 0 },
      sections: [
        {
          site: "A101",
          district: "North District",
          street: "Bride’s Pool Road",
          section: "Bride’s Pool Road (near Bride’s Pool ex-Bus Terminus)",
          vehicleType: "car",
          spaces: 2,
          vacant: 0,
          occupied: 0,
          notInUse: 2,
          noData: 0,
          latitude: 22.502228,
          longitude: 114.237742,
          updated: "2026-07-02T09:09:40+08:00",
        },
        {
          site: "A101",
          district: "North District",
          street: "Bride’s Pool Road",
          section: "Bride’s Pool Road (near Bride’s Pool ex-Bus Terminus)",
          vehicleType: "coach",
          spaces: 1,
          vacant: 0,
          occupied: 0,
          notInUse: 1,
          noData: 0,
          latitude: 22.502201,
          longitude: 114.237398,
          updated: "2025-09-19T15:16:27+08:00",
        },
      ],
    },
    ttl: 120,
  },
  {
    name: "parking_sensor_vacancy lists disabled spaces in Chinese",
    tool: "parking_sensor_vacancy",
    input: { vehicleType: "disabled", lang: "tc" },
    request: { url: SENSOR_SPACES },
    reply: sensorSpaces,
    lookups: { [SENSOR_OCCUPANCY]: sensorOccupancy },
    data: {
      listDate: "2026-10-18",
      total: { spaces: 1, vacant: 1, occupied: 0, notInUse: 0, noData: 0 },
      sections: [
        {
          site: "A115",
          district: "沙田區",
          street: "恆信街",
          section: "恆信街",
          vehicleType: "disabled",
          spaces: 1,
          vacant: 1,
          occupied: 0,
          notInUse: 0,
          noData: 0,
          latitude: 22.407261,
          longitude: 114.223089,
          updated: "2026-10-18T19:34:48+08:00",
        },
      ],
    },
  },

  // td-traffic
  {
    tool: "traffic_news",
    input: { search: "ting kau" },
    request: { url: "https://www.td.gov.hk/en/special_news/trafficnews.xml" },
    reply: `<?xml version="1.0" encoding="UTF-8"?>
<list xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="https://www.td.gov.hk/en/special_news/trafficnews.xsd">
  <message>
    <INCIDENT_NUMBER>IN-26-07624</INCIDENT_NUMBER>
    <INCIDENT_HEADING_EN>Road Incident</INCIDENT_HEADING_EN>
    <INCIDENT_HEADING_CN>道路事故</INCIDENT_HEADING_CN>
    <INCIDENT_DETAIL_EN>Traffic Accident</INCIDENT_DETAIL_EN>
    <INCIDENT_DETAIL_CN>交通意外</INCIDENT_DETAIL_CN>
    <LOCATION_EN>Gloucester Road Service Road</LOCATION_EN>
    <LOCATION_CN>告士打道輔助道路</LOCATION_CN>
    <DISTRICT_EN/>
    <DISTRICT_CN/>
    <DIRECTION_EN>Central</DIRECTION_EN>
    <DIRECTION_CN>中環</DIRECTION_CN>
    <ANNOUNCEMENT_DATE>2026-10-18T21:19:00</ANNOUNCEMENT_DATE>
    <INCIDENT_STATUS_EN>CLOSED</INCIDENT_STATUS_EN>
    <INCIDENT_STATUS_CN>完結</INCIDENT_STATUS_CN>
    <NEAR_LANDMARK_EN>Marsh Road</NEAR_LANDMARK_EN>
    <NEAR_LANDMARK_CN>馬師道</NEAR_LANDMARK_CN>
    <BETWEEN_LANDMARK_EN/>
    <BETWEEN_LANDMARK_CN/>
    <ID>148152</ID>
    <CONTENT_EN>The only lane of Gloucester Road Service Road (Inner Gloucester Road) (Central bound) near Marsh Road which was closed due to traffic accident is re-opened to all traffic. </CONTENT_EN>
    <CONTENT_CN>較早前因交通意外而封閉的告士打道輔助道路(內告士打道)(往中環方向)近馬師道的唯一行車線現已解封。</CONTENT_CN>
    <LATITUDE/>
    <LONGITUDE/>
  </message>
  <message>
    <INCIDENT_NUMBER>IN-26-07625</INCIDENT_NUMBER>
    <INCIDENT_HEADING_EN>Road Incident</INCIDENT_HEADING_EN>
    <INCIDENT_HEADING_CN>道路事故</INCIDENT_HEADING_CN>
    <INCIDENT_DETAIL_EN>Traffic Accident</INCIDENT_DETAIL_EN>
    <INCIDENT_DETAIL_CN>交通意外</INCIDENT_DETAIL_CN>
    <LOCATION_EN>Tsing Long Highway (Ting Kau Bridge)</LOCATION_EN>
    <LOCATION_CN>青朗公路(汀九橋)</LOCATION_CN>
    <DISTRICT_EN>Tsuen Wan</DISTRICT_EN>
    <DISTRICT_CN>荃灣</DISTRICT_CN>
    <DIRECTION_EN>Kowloon</DIRECTION_EN>
    <DIRECTION_CN>九龍</DIRECTION_CN>
    <ANNOUNCEMENT_DATE>2026-10-18T22:47:00</ANNOUNCEMENT_DATE>
    <INCIDENT_STATUS_EN>NEW</INCIDENT_STATUS_EN>
    <INCIDENT_STATUS_CN>最新情況</INCIDENT_STATUS_CN>
    <NEAR_LANDMARK_EN/>
    <NEAR_LANDMARK_CN/>
    <BETWEEN_LANDMARK_EN/>
    <BETWEEN_LANDMARK_CN/>
    <ID>148153</ID>
    <CONTENT_EN>Due to traffic accident , the fast lane of Tsing Long Highway (Ting Kau Bridge) (Kowloon bound) is closed to all traffic. Only remaining lanes are available to motorists. </CONTENT_EN>
    <CONTENT_CN>因交通意外，青朗公路(汀九橋)(往九龍方向) 的快線現已封閉。 駕駛人士只可使用餘下行車線行車。</CONTENT_CN>
    <LATITUDE>22.3618</LATITUDE>
    <LONGITUDE>114.1087</LONGITUDE>
  </message>
</list>`,
    data: [
      {
        id: 148153,
        incidentNumber: "IN-26-07625",
        status: "new",
        heading: "Road Incident",
        detail: "Traffic Accident",
        location: "Tsing Long Highway (Ting Kau Bridge)",
        district: "Tsuen Wan",
        direction: "Kowloon",
        announcedAt: "2026-10-18T22:47:00+08:00",
        content: "Due to traffic accident , the fast lane of Tsing Long Highway (Ting Kau Bridge) (Kowloon bound) is closed to all traffic. Only remaining lanes are available to motorists.",
        latitude: 22.3618,
        longitude: 114.1087,
      },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 120,
  },
  {
    name: "traffic_news reads the Chinese copy of a single message and filters by district",
    tool: "traffic_news",
    input: { district: "荃灣", lang: "tc" },
    request: { url: "https://www.td.gov.hk/tc/special_news/trafficnews.xml" },
    reply: `<?xml version="1.0" encoding="UTF-8"?>
<list>
  <message>
    <INCIDENT_NUMBER>IN-26-07625</INCIDENT_NUMBER>
    <INCIDENT_HEADING_EN>Road Incident</INCIDENT_HEADING_EN>
    <INCIDENT_HEADING_CN>道路事故</INCIDENT_HEADING_CN>
    <INCIDENT_DETAIL_EN>Traffic Accident</INCIDENT_DETAIL_EN>
    <INCIDENT_DETAIL_CN>交通意外</INCIDENT_DETAIL_CN>
    <LOCATION_EN>Tsing Long Highway (Ting Kau Bridge)</LOCATION_EN>
    <LOCATION_CN>青朗公路(汀九橋)</LOCATION_CN>
    <DISTRICT_EN>Tsuen Wan</DISTRICT_EN>
    <DISTRICT_CN>荃灣</DISTRICT_CN>
    <DIRECTION_EN>Kowloon</DIRECTION_EN>
    <DIRECTION_CN>九龍</DIRECTION_CN>
    <ANNOUNCEMENT_DATE>2026-10-18T23:04:00</ANNOUNCEMENT_DATE>
    <INCIDENT_STATUS_EN>UPDATED</INCIDENT_STATUS_EN>
    <INCIDENT_STATUS_CN>更新情況</INCIDENT_STATUS_CN>
    <ID>148154</ID>
    <CONTENT_EN>The fast lane of Tsing Long Highway (Ting Kau Bridge) (Kowloon bound) which was closed due to traffic accident is re-opened to all traffic. </CONTENT_EN>
    <CONTENT_CN>較早前因交通意外而封閉的青朗公路(汀九橋)(往九龍方向) 的快線現已解封。</CONTENT_CN>
    <LATITUDE/>
    <LONGITUDE/>
  </message>
</list>`,
    data: [
      {
        id: 148154,
        incidentNumber: "IN-26-07625",
        status: "updated",
        heading: "道路事故",
        detail: "交通意外",
        location: "青朗公路(汀九橋)",
        district: "荃灣",
        direction: "九龍",
        announcedAt: "2026-10-18T23:04:00+08:00",
        content: "較早前因交通意外而封閉的青朗公路(汀九橋)(往九龍方向) 的快線現已解封。",
      },
    ],
  },
  {
    tool: "traffic_journey_times",
    input: { to: "airport" },
    request: { url: "https://resource.data.one.gov.hk/td/jss/Journeytimev2.xml" },
    reply: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<jtis_journey_list xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://data.one.gov.hk/td http://data.one.gov.hk/xsd/td/journeytime.xsd" xmlns="http://data.one.gov.hk/td">
    <jtis_journey_time>
        <LOCATION_ID>H1</LOCATION_ID>
        <DESTINATION_ID>CH</DESTINATION_ID>
        <CAPTURE_DATE>2026-10-18T23:09:00</CAPTURE_DATE>
        <JOURNEY_TYPE>1</JOURNEY_TYPE>
        <JOURNEY_DATA>4</JOURNEY_DATA>
        <COLOUR_ID>3</COLOUR_ID>
        <JOURNEY_DESC/>
    </jtis_journey_time>
    <jtis_journey_time>
        <LOCATION_ID>K07</LOCATION_ID>
        <DESTINATION_ID>ACTT</DESTINATION_ID>
        <CAPTURE_DATE>2026-10-18T23:09:00</CAPTURE_DATE>
        <JOURNEY_TYPE>1</JOURNEY_TYPE>
        <JOURNEY_DATA>21</JOURNEY_DATA>
        <COLOUR_ID>2</COLOUR_ID>
        <JOURNEY_DESC/>
    </jtis_journey_time>
    <jtis_journey_time>
        <LOCATION_ID>K07</LOCATION_ID>
        <DESTINATION_ID>ATSCA</DESTINATION_ID>
        <CAPTURE_DATE>2026-10-18T23:11:00</CAPTURE_DATE>
        <JOURNEY_TYPE>2</JOURNEY_TYPE>
        <JOURNEY_DATA>3</JOURNEY_DATA>
        <COLOUR_ID>-1</COLOUR_ID>
        <JOURNEY_DESC>Tunnel Closed</JOURNEY_DESC>
    </jtis_journey_time>
    <jtis_journey_time>
        <LOCATION_ID>K07</LOCATION_ID>
        <DESTINATION_ID>WH</DESTINATION_ID>
        <CAPTURE_DATE>2026-10-18T23:09:00</CAPTURE_DATE>
        <JOURNEY_TYPE>1</JOURNEY_TYPE>
        <JOURNEY_DATA>6</JOURNEY_DATA>
        <COLOUR_ID>3</COLOUR_ID>
        <JOURNEY_DESC/>
    </jtis_journey_time>
</jtis_journey_list>`,
    data: {
      capturedAt: "2026-10-18T23:11:00+08:00",
      indicators: [
        {
          code: "K07",
          location: "West Kowloon Highway westbound near MTR Nam Cheong Station",
          region: "Kowloon",
          journeys: [
            { destinationCode: "ACTT", destination: "Airport via Route 3", minutes: 21, colour: "amber" },
            { destinationCode: "ATSCA", destination: "Airport via Route 8", minutes: null, colour: null, notice: "Tunnel closed" },
          ],
        },
      ],
    },
    ttl: 120,
  },
  {
    name: "traffic_journey_times picks one sign by its code, in Simplified Chinese",
    tool: "traffic_journey_times",
    input: { from: "h1", lang: "sc" },
    request: { url: "https://resource.data.one.gov.hk/td/jss/Journeytimev2.xml" },
    reply: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<jtis_journey_list xmlns="http://data.one.gov.hk/td">
    <jtis_journey_time><LOCATION_ID>H1</LOCATION_ID><DESTINATION_ID>CH</DESTINATION_ID><CAPTURE_DATE>2026-10-18T23:09:00</CAPTURE_DATE><JOURNEY_TYPE>1</JOURNEY_TYPE><JOURNEY_DATA>4</JOURNEY_DATA><COLOUR_ID>3</COLOUR_ID><JOURNEY_DESC/></jtis_journey_time>
    <jtis_journey_time><LOCATION_ID>H11</LOCATION_ID><DESTINATION_ID>EH</DESTINATION_ID><CAPTURE_DATE>2026-10-18T23:09:00</CAPTURE_DATE><JOURNEY_TYPE>1</JOURNEY_TYPE><JOURNEY_DATA>4</JOURNEY_DATA><COLOUR_ID>3</COLOUR_ID><JOURNEY_DESC/></jtis_journey_time>
    <jtis_journey_time><LOCATION_ID>H1</LOCATION_ID><DESTINATION_ID>EH</DESTINATION_ID><CAPTURE_DATE>2026-10-18T23:09:00</CAPTURE_DATE><JOURNEY_TYPE>2</JOURNEY_TYPE><JOURNEY_DATA>1</JOURNEY_DATA><COLOUR_ID>1</COLOUR_ID><JOURNEY_DESC>Traffic Congestion</JOURNEY_DESC></jtis_journey_time>
</jtis_journey_list>`,
    data: {
      capturedAt: "2026-10-18T23:09:00+08:00",
      indicators: [
        {
          code: "H1",
          location: "告士打道东行近税务大楼",
          region: "香港岛",
          journeys: [
            { destinationCode: "CH", destination: "红磡海底隧道", minutes: 4, colour: "green" },
            { destinationCode: "EH", destination: "东区海底隧道", minutes: null, colour: "red", notice: "交通挤塞" },
          ],
        },
      ],
    },
  },
  {
    tool: "traffic_cameras",
    input: { search: "tunnel", region: "hongKongIsland" },
    request: { url: "https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_En.xml" },
    reply: `<?xml version="1.0" encoding="UTF-8"?>
<image-list>
	<image>
		<key>H429F</key>
		<region>Hong Kong Island</region>
		<district>Southern</district>
		<description>Aberdeen Praya Road near Fish Market [H429F]</description>
		<easting>833549</easting>
		<northing>812187</northing>
		<latitude>22.24845</latitude>
		<longitude>114.1505</longitude>
		<url>https://tdcctv.data.one.gov.hk/H429F.JPG</url>
	</image>
	<image>
		<key>H210F</key>
		<region>Hong Kong Island</region>
		<district>Wan Chai</district>
		<description>Aberdeen Tunnel - Wan Chai Side [H210F]</description>
		<easting>836525</easting>
		<northing>815094</northing>
		<latitude>22.2747</latitude>
		<longitude>114.17936</longitude>
		<url>https://tdcctv.data.one.gov.hk/H210F.JPG</url>
	</image>
	<image>
		<key>H207F</key>
		<region>Hong Kong Island</region>
		<district>Wan Chai</district>
		<description>Cross Harbour Tunnel Hong Kong Side [H207F]</description>
		<easting>836788</easting>
		<northing>815823</northing>
		<latitude>22.28128179</latitude>
		<longitude>114.1819201</longitude>
		<url>https://tdcctv.data.one.gov.hk/H207F.JPG</url>
	</image>
	<image>
		<key>K107F</key>
		<region>Kowloon</region>
		<district>Yau Tsim Mong</district>
		<description>Cross Harbour Tunnel Kowloon Side [K107F]</description>
		<easting>836665</easting>
		<northing>818282</northing>
		<latitude>22.30349</latitude>
		<longitude>114.18073</longitude>
		<url>https://tdcctv.data.one.gov.hk/K107F.JPG</url>
	</image>
</image-list>`,
    data: [
      { key: "H210F", region: "Hong Kong Island", district: "Wan Chai", description: "Aberdeen Tunnel - Wan Chai Side", latitude: 22.2747, longitude: 114.17936, imageUrl: "https://tdcctv.data.one.gov.hk/H210F.JPG" },
      { key: "H207F", region: "Hong Kong Island", district: "Wan Chai", description: "Cross Harbour Tunnel Hong Kong Side", latitude: 22.28128179, longitude: 114.1819201, imageUrl: "https://tdcctv.data.one.gov.hk/H207F.JPG" },
    ],
    meta: { total: 2, returned: 2, truncated: false },
    ttl: 86400,
  },
  {
    name: "traffic_cameras filters by district in Traditional Chinese",
    tool: "traffic_cameras",
    input: { district: "黃大仙", lang: "tc" },
    request: { url: "https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_Tc.xml" },
    reply: `<?xml version="1.0" encoding="UTF-8"?>
<image-list>
	<image><key>K505F</key><region>九龍</region><district>黃大仙區</district><description>龍翔道/竹園道 [K505F]</description><easting>836794</easting><northing>821148</northing><latitude>22.34290651</latitude><longitude>114.1845919</longitude><url>https://tdcctv.data.one.gov.hk/K505F.JPG</url></image>
	<image><key>H429F</key><region>香港島</region><district>南區</district><description>香港仔海傍道近魚市場 [H429F]</description><easting>833549</easting><northing>812187</northing><latitude>22.24845</latitude><longitude>114.1505</longitude><url>https://tdcctv.data.one.gov.hk/H429F.JPG</url></image>
</image-list>`,
    data: [{ key: "K505F", region: "九龍", district: "黃大仙區", description: "龍翔道/竹園道", latitude: 22.34290651, longitude: 114.1845919, imageUrl: "https://tdcctv.data.one.gov.hk/K505F.JPG" }],
  },
  // hk-taxi-fleet
  {
    tool: "amigo_taxi_fleet",
    input: { status: "V", taxiType: "O", lat: 22.3, long: 114.17, radiusKm: 5 },
    request: { url: "https://api.amigo.taxi/webx/v1/vehicle/list" },
    reply: {
      taxis: [
        { veh_id: "AMG1001", taxi_type: "O", passenger_cap: 4, op_status: "V", lat: 22.301, long: 114.171, time_stamp: "2026-10-19T12:00:00Z" },
        { veh_id: "AMG1002", taxi_type: "O", passenger_cap: 5, op_status: "V", lat: 22.45, long: 114.17, time_stamp: "2026-10-19T12:00:00Z" },
        { veh_id: "AMG1003", taxi_type: "P", passenger_cap: 4, op_status: "O", lat: 22.301, long: 114.171, time_stamp: "2026-10-19T12:00:00Z" },
      ],
    },
    data: [
      {
        veh_id: "AMG1001",
        taxi_type: "O",
        taxi_type_label: "Ordinary",
        passenger_cap: 4,
        op_status: "V",
        status_label: "Vacant",
        lat: 22.301,
        long: 114.171,
        time_stamp: "2026-10-19T12:00:00Z",
        distance_km: 0.15,
      },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 30,
  },
  {
    tool: "big_boss_taxi_fleet",
    input: { vehId: "BBT002" },
    request: { url: "https://data.bigboss.hk/api/opendata/get_data/all" },
    reply: {
      taxis: [
        { veh_id: "BBT001", taxi_type: "O", passenger_cap: 4, op_status: "V", lat: 22.31, long: 114.18, time_stamp: "2026-10-19T12:00:00Z" },
        { veh_id: "BBT002", taxi_type: "W", passenger_cap: 5, op_status: "N", lat: 22.32, long: 114.19, time_stamp: "2026-10-19T12:00:00Z" },
      ],
    },
    data: [
      {
        veh_id: "BBT002",
        taxi_type: "W",
        taxi_type_label: "Wheelchair",
        passenger_cap: 5,
        op_status: "N",
        status_label: "Not in service",
        lat: 22.32,
        long: 114.19,
        time_stamp: "2026-10-19T12:00:00Z",
      },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 30,
  },

  // censtatd-shipping
  {
    tool: "shipping_port_cargo_throughput",
    input: { freq: "Y", period: "2025", direction: "Total", shipmentType: "Total" },
    request: { url: "https://www.censtatd.gov.hk/api/get.php?id=410-55110&full_series=1&lang=en" },
    reply: {
      header: { status: { name: "Success", description: "Request Confirmation" } },
      dataSet: [
        { DIRECTION: "", DIRECTIONDesc: "Total", SHIPMENT_TYPE: "", SHIPMENT_TYPEDesc: "Total", TRANS: "T", TRANSDesc: "Total", freq: "Y", period: "2024", sv: "CGO_WT", svDesc: "(\x27000 tonnes)", figure: 176731, sd_value: "" },
        { DIRECTION: "", DIRECTIONDesc: "Total", SHIPMENT_TYPE: "", SHIPMENT_TYPEDesc: "Total", TRANS: "T", TRANSDesc: "Total", freq: "Y", period: "2025", sv: "CGO_WT", svDesc: "(\x27000 tonnes)", figure: 171186, sd_value: "" },
        { DIRECTION: "In", DIRECTIONDesc: "Inward", SHIPMENT_TYPE: "DS", SHIPMENT_TYPEDesc: "Direct shipment", TRANS: "S", TRANSDesc: "Seaborne", freq: "Y", period: "2025", sv: "CGO_WT", svDesc: "(\x27000 tonnes)", figure: 62507, sd_value: "" },
      ],
    },
    data: [
      { DIRECTION: "Total", DIRECTIONDesc: "Total", SHIPMENT_TYPE: "Total", SHIPMENT_TYPEDesc: "Total", TRANS: "T", TRANSDesc: "Total", freq: "Y", period: "2025", sv: "CGO_WT", svDesc: "(\x27000 tonnes)", figure: 171186, sd_value: "" },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 3600,
  },
  {
    tool: "shipping_seaborne_cargo_throughput",
    input: { freq: "Y", period: "2025", direction: "In" },
    request: { url: "https://www.censtatd.gov.hk/api/get.php?id=410-55111&full_series=1&lang=en" },
    reply: {
      header: { status: { name: "Success", description: "Request Confirmation" } },
      dataSet: [
        { DIRECTION: "In", DIRECTIONDesc: "Inward", SHIPMENT_TYPE: "", SHIPMENT_TYPEDesc: "Total", freq: "Y", period: "2024", sv: "CGO_WT", svDesc: "(\x27000 tonnes)", figure: 73000, sd_value: "" },
        { DIRECTION: "In", DIRECTIONDesc: "Inward", SHIPMENT_TYPE: "", SHIPMENT_TYPEDesc: "Total", freq: "Y", period: "2025", sv: "CGO_WT", svDesc: "(\x27000 tonnes)", figure: 71500, sd_value: "" },
      ],
    },
    data: [
      { DIRECTION: "In", DIRECTIONDesc: "Inward", SHIPMENT_TYPE: "Total", SHIPMENT_TYPEDesc: "Total", freq: "Y", period: "2025", sv: "CGO_WT", svDesc: "(\x27000 tonnes)", figure: 71500, sd_value: "" },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 3600,
  },
  {
    tool: "shipping_seaborne_cargo_monthly",
    input: { period: "202512" },
    request: { url: "https://www.censtatd.gov.hk/api/get.php?id=410-55111A&full_series=1&lang=en" },
    reply: {
      header: { status: { name: "Success", description: "Request Confirmation" } },
      dataSet: [
        { DIRECTION: "", DIRECTIONDesc: "Total", SHIPMENT_TYPE: "", SHIPMENT_TYPEDesc: "Total", freq: "M", period: "202511", sv: "CGO_WT", svDesc: "(\x27000 tonnes)", figure: 9100, sd_value: "" },
        { DIRECTION: "", DIRECTIONDesc: "Total", SHIPMENT_TYPE: "", SHIPMENT_TYPEDesc: "Total", freq: "M", period: "202512", sv: "CGO_WT", svDesc: "(\x27000 tonnes)", figure: 9500, sd_value: "" },
      ],
    },
    data: [
      { DIRECTION: "Total", DIRECTIONDesc: "Total", SHIPMENT_TYPE: "Total", SHIPMENT_TYPEDesc: "Total", freq: "M", period: "202512", sv: "CGO_WT", svDesc: "(\x27000 tonnes)", figure: 9500, sd_value: "" },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 3600,
  },
  {
    tool: "shipping_river_cargo_throughput",
    input: { freq: "Q", period: "2025" },
    request: { url: "https://www.censtatd.gov.hk/api/get.php?id=410-55112&full_series=1&lang=en" },
    reply: {
      header: { status: { name: "Success", description: "Request Confirmation" } },
      dataSet: [
        { DIRECTION: "", DIRECTIONDesc: "Total", SHIPMENT_TYPE: "", SHIPMENT_TYPEDesc: "Total", freq: "Q", period: "202509", sv: "CGO_WT", svDesc: "(\x27000 tonnes)", figure: 14200, sd_value: "" },
        { DIRECTION: "", DIRECTIONDesc: "Total", SHIPMENT_TYPE: "", SHIPMENT_TYPEDesc: "Total", freq: "Q", period: "202512", sv: "CGO_WT", svDesc: "(\x27000 tonnes)", figure: 15100, sd_value: "" },
      ],
    },
    data: [
      { DIRECTION: "Total", DIRECTIONDesc: "Total", SHIPMENT_TYPE: "Total", SHIPMENT_TYPEDesc: "Total", freq: "Q", period: "202512", sv: "CGO_WT", svDesc: "(\x27000 tonnes)", figure: 15100, sd_value: "" },
      { DIRECTION: "Total", DIRECTIONDesc: "Total", SHIPMENT_TYPE: "Total", SHIPMENT_TYPEDesc: "Total", freq: "Q", period: "202509", sv: "CGO_WT", svDesc: "(\x27000 tonnes)", figure: 14200, sd_value: "" },
    ],
    meta: { total: 2, returned: 2, truncated: false },
    ttl: 3600,
  },
  {
    tool: "shipping_river_cargo_monthly",
    input: { period: "202512", direction: "Out" },
    request: { url: "https://www.censtatd.gov.hk/api/get.php?id=410-55112A&full_series=1&lang=en" },
    reply: {
      header: { status: { name: "Success", description: "Request Confirmation" } },
      dataSet: [
        { DIRECTION: "Out", DIRECTIONDesc: "Outward", SHIPMENT_TYPE: "", SHIPMENT_TYPEDesc: "Total", freq: "M", period: "202512", sv: "CGO_WT", svDesc: "(\x27000 tonnes)", figure: 2100, sd_value: "" },
      ],
    },
    data: [
      { DIRECTION: "Out", DIRECTIONDesc: "Outward", SHIPMENT_TYPE: "Total", SHIPMENT_TYPEDesc: "Total", freq: "M", period: "202512", sv: "CGO_WT", svDesc: "(\x27000 tonnes)", figure: 2100, sd_value: "" },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 3600,
  },
  {
    tool: "shipping_port_cargo_seasonally_adjusted",
    input: { period: "202512", direction: "Total" },
    request: { url: "https://www.censtatd.gov.hk/api/get.php?id=410-55113&full_series=1&lang=en" },
    reply: {
      header: { status: { name: "Success", description: "Request Confirmation" } },
      dataSet: [
        { DIRECTION: "", DIRECTIONDesc: "Total", SHIPMENT_TYPE: "", SHIPMENT_TYPEDesc: "Total", freq: "Q", period: "202512", sv: "SA_CGO_WT_chg", svDesc: "%", figure: 1.8, sd_value: "" },
      ],
    },
    data: [
      { DIRECTION: "Total", DIRECTIONDesc: "Total", SHIPMENT_TYPE: "Total", SHIPMENT_TYPEDesc: "Total", freq: "Q", period: "202512", sv: "SA_CGO_WT_chg", svDesc: "%", figure: 1.8, sd_value: "" },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 3600,
  },
  {
    tool: "shipping_port_cargo_gba_city",
    input: { city: "Shenzhen", period: "2025", lang: "tc" },
    request: { url: "https://www.censtatd.gov.hk/api/get.php?id=410-55114&full_series=1&lang=tc" },
    reply: {
      header: { status: { name: "Success", description: "Request Confirmation" } },
      dataSet: [
        { DIRECTION: "", DIRECTIONDesc: "總計", SHIPMENT_TYPE: "", SHIPMENT_TYPEDesc: "總計", TRANS: "T", TRANSDesc: "總計", COUNTRY: "SZ", COUNTRYDesc: "深圳 (Shenzhen)", freq: "Y", period: "2025", sv: "CGO_WT", svDesc: "(千公噸)", figure: 18500, sd_value: "" },
        { DIRECTION: "", DIRECTIONDesc: "總計", SHIPMENT_TYPE: "", SHIPMENT_TYPEDesc: "總計", TRANS: "T", TRANSDesc: "總計", COUNTRY: "GZ", COUNTRYDesc: "廣州 (Guangzhou)", freq: "Y", period: "2025", sv: "CGO_WT", svDesc: "(千公噸)", figure: 22100, sd_value: "" },
      ],
    },
    data: [
      { DIRECTION: "Total", DIRECTIONDesc: "總計", SHIPMENT_TYPE: "Total", SHIPMENT_TYPEDesc: "總計", TRANS: "T", TRANSDesc: "總計", COUNTRY: "SZ", COUNTRYDesc: "深圳 (Shenzhen)", freq: "Y", period: "2025", sv: "CGO_WT", svDesc: "(千公噸)", figure: 18500, sd_value: "" },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 3600,
  },
  {
    tool: "shipping_container_throughput",
    input: { freq: "Y", period: "2025", direction: "Total", containerType: "Laden" },
    request: { url: "https://www.censtatd.gov.hk/api/get.php?id=410-55290&full_series=1&lang=en" },
    reply: {
      header: { status: { name: "Success", code: 0 } },
      dataSet: [
        { DIRECTION: "", DIRECTIONDesc: "Total", CONTAINER_TYPE: "", CONTAINER_TYPEDesc: "Total", freq: "Y", period: "2025", sv: "PORT_CONTAINER_TP", svDesc: "(\x27000 TEUs)", figure: 13688, sd_value: "" },
        { DIRECTION: "", DIRECTIONDesc: "Total", CONTAINER_TYPE: "Laden", CONTAINER_TYPEDesc: "Laden", freq: "Y", period: "2025", sv: "PORT_CONTAINER_TP", svDesc: "(\x27000 TEUs)", figure: 10845, sd_value: "" },
      ],
    },
    data: [
      { DIRECTION: "Total", DIRECTIONDesc: "Total", CONTAINER_TYPE: "Laden", CONTAINER_TYPEDesc: "Laden", freq: "Y", period: "2025", sv: "PORT_CONTAINER_TP", svDesc: "(\x27000 TEUs)", figure: 10845, sd_value: "" },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 3600,
  },
  {
    tool: "shipping_laden_container_throughput",
    input: { freq: "Q", period: "202606", direction: "Out", shipmentType: "TS" },
    request: { url: "https://www.censtatd.gov.hk/api/get.php?id=410-55291&full_series=1&lang=en" },
    reply: {
      header: { status: { name: "Success", code: 0 } },
      dataSet: [
        { CONTAINER_TYPE: "Laden", CONTAINER_TYPEDesc: "Laden", DIRECTION: "Out", DIRECTIONDesc: "Outward", SHIPMENT_TYPE: "TS", SHIPMENT_TYPEDesc: "Transhipment", freq: "Q", period: "202606", sv: "PORT_CONTAINER_TP", svDesc: "Year-on-year % change", figure: 3.4, sd_value: "" },
      ],
    },
    data: [
      { CONTAINER_TYPE: "Laden", CONTAINER_TYPEDesc: "Laden", DIRECTION: "Out", DIRECTIONDesc: "Outward", SHIPMENT_TYPE: "TS", SHIPMENT_TYPEDesc: "Transhipment", freq: "Q", period: "202606", sv: "PORT_CONTAINER_TP", svDesc: "Year-on-year % change", figure: 3.4, sd_value: "" },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 3600,
  },
  {
    tool: "shipping_laden_container_seasonally_adjusted",
    input: { period: "202606", direction: "Total", shipmentType: "Total" },
    request: { url: "https://www.censtatd.gov.hk/api/get.php?id=410-55292&full_series=1&lang=en" },
    reply: {
      header: { status: { name: "Success", code: 0 } },
      dataSet: [
        { CONTAINER_TYPE: "Laden", CONTAINER_TYPEDesc: "Laden", DIRECTION: "", DIRECTIONDesc: "Total", SHIPMENT_TYPE: "", SHIPMENT_TYPEDesc: "Total", freq: "Q", period: "202606", sv: "SA_CONTAINER_TP", svDesc: "Quarter-to-quarter % Change", figure: 1.2, sd_value: "" },
      ],
    },
    data: [
      { CONTAINER_TYPE: "Laden", CONTAINER_TYPEDesc: "Laden", DIRECTION: "Total", DIRECTIONDesc: "Total", SHIPMENT_TYPE: "Total", SHIPMENT_TYPEDesc: "Total", freq: "Q", period: "202606", sv: "SA_CONTAINER_TP", svDesc: "Quarter-to-quarter % Change", figure: 1.2, sd_value: "" },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 3600,
  },
  {
    tool: "shipping_laden_container_gba_city",
    input: { freq: "Q", period: "202606", city: "Zhongshan" },
    request: { url: "https://www.censtatd.gov.hk/api/get.php?id=410-55293&full_series=1&lang=en" },
    reply: {
      header: { status: { name: "Success", code: 0 } },
      dataSet: [
        { CONTAINER_TYPE: "Laden", CONTAINER_TYPEDesc: "Laden", COUNTRY: "631GBA_ZS", COUNTRYDesc: "Zhongshan", freq: "Q", period: "202606", sv: "PORT_CONTAINER_TP", svDesc: "Year-on-year % change", figure: 3.3, sd_value: "" },
        { CONTAINER_TYPE: "Laden", CONTAINER_TYPEDesc: "Laden", COUNTRY: "631GBA_SZ", COUNTRYDesc: "Shenzhen", freq: "Q", period: "202606", sv: "PORT_CONTAINER_TP", svDesc: "Year-on-year % change", figure: 4.1, sd_value: "" },
      ],
    },
    data: [
      { CONTAINER_TYPE: "Laden", CONTAINER_TYPEDesc: "Laden", COUNTRY: "631GBA_ZS", COUNTRYDesc: "Zhongshan", freq: "Q", period: "202606", sv: "PORT_CONTAINER_TP", svDesc: "Year-on-year % change", figure: 3.3, sd_value: "" },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 3600,
  },
  {
    tool: "shipping_container_handling_location",
    input: { freq: "M", period: "202607", location: "CT", direction: "Total", containerType: "Total" },
    request: { url: "https://www.censtatd.gov.hk/api/get.php?id=410-55294&full_series=1&lang=en" },
    reply: {
      header: { status: { name: "Success", code: 0 } },
      dataSet: [
        { CHL: "", CHLDesc: "Total", DIRECTION: "", DIRECTIONDesc: "Total", CONTAINER_TYPE: "", CONTAINER_TYPEDesc: "Total", freq: "M", period: "202607", sv: "PORT_CONTAINER_TP", svDesc: "(\x27000 TEUs)", figure: 1150, sd_value: "p" },
        { CHL: "CT", CHLDesc: "Kwai Tsing Container Terminals", DIRECTION: "", DIRECTIONDesc: "Total", CONTAINER_TYPE: "", CONTAINER_TYPEDesc: "Total", freq: "M", period: "202607", sv: "PORT_CONTAINER_TP", svDesc: "(\x27000 TEUs)", figure: 890, sd_value: "p" },
      ],
    },
    data: [
      { CHL: "CT", CHLDesc: "Kwai Tsing Container Terminals", DIRECTION: "Total", DIRECTIONDesc: "Total", CONTAINER_TYPE: "Total", CONTAINER_TYPEDesc: "Total", freq: "M", period: "202607", sv: "PORT_CONTAINER_TP", svDesc: "(\x27000 TEUs)", figure: 890, sd_value: "p" },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 3600,
  },

  // censtatd-transport
  {
    tool: "air_cargo_movements",
    input: { freq: "Q", period: "202603", region: "NorthA", direction: "Loaded" },
    request: { url: "https://www.censtatd.gov.hk/api/get.php?id=410-92011&full_series=1&lang=en" },
    reply: {
      header: { status: { name: "Success", code: 0 } },
      dataSet: [
        { REGION: "", REGIONDesc: "Total", DIRECTION: "", DIRECTIONDesc: "Total", freq: "Q", period: "202603", sv: "AIR_CARGO_THROUGHPUT", svDesc: "(\x27000 tonnes)", figure: 1120, sd_value: "" },
        { REGION: "NorthA", REGIONDesc: "North America", DIRECTION: 2, DIRECTIONDesc: "Loaded", freq: "Q", period: "202603", sv: "AIR_CARGO_THROUGHPUT", svDesc: "(\x27000 tonnes)", figure: 138, sd_value: "" },
      ],
    },
    data: [
      { REGION: "NorthA", REGIONDesc: "North America", DIRECTION: "Loaded", DIRECTIONDesc: "Loaded", freq: "Q", period: "202603", sv: "AIR_CARGO_THROUGHPUT", svDesc: "(\x27000 tonnes)", indicatorDesc: "Air cargo throughput", figure: 138, sd_value: "" },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 3600,
  },
  {
    tool: "postal_services_statistics",
    input: { freq: "Q", period: "202606", mailType: "HKPOST_PARCELS", category: "PM_OHKL", lang: "tc" },
    request: { url: "https://www.censtatd.gov.hk/api/get.php?id=635-92076&full_series=1&lang=tc" },
    reply: {
      header: { status: { name: "Success", code: 0 } },
      dataSet: [
        { PM: "PM_LO", PMDesc: "本地", freq: "Q", period: "202606", sv: "HKPOST_PARCELS", svDesc: "千件包裹", figure: 3, sd_value: "" },
        { PM: "PM_OHKL", PMDesc: "本地派遞的從外地寄出", freq: "Q", period: "202606", sv: "HKPOST_PARCELS", svDesc: "千件包裹", figure: 62, sd_value: "" },
      ],
    },
    data: [
      { PM: "PM_OHKL", PMDesc: "本地派遞的從外地寄出", freq: "Q", period: "202606", sv: "HKPOST_PARCELS", svDesc: "千件包裹", indicatorDesc: "香港郵政處理的包裹", figure: 62, sd_value: "" },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 3600,
  },
  {
    tool: "air_transport_capacity",
    input: { period: "2025", indicator: "AIR_SEAT_CAP" },
    request: { url: "https://www.censtatd.gov.hk/api/get.php?id=635-93002&full_series=1&lang=en" },
    reply: {
      header: { status: { name: "Success", code: 0 } },
      dataSet: [
        { freq: "Y", period: "2024", sv: "AIR_SEAT_CAP", svDesc: "Number", figure: 760900, sd_value: "" },
        { freq: "Y", period: "2025", sv: "AIR_SEAT_CAP", svDesc: "Number", figure: 818036, sd_value: "" },
      ],
    },
    data: [
      { freq: "Y", period: "2025", sv: "AIR_SEAT_CAP", svDesc: "Number", indicatorDesc: "Total seat capacity per week", figure: 818036, sd_value: "" },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 3600,
  },
  {
    tool: "seafarers_statistics",
    input: { period: "2025", indicator: "HK_SEAFARER_AGREE" },
    request: { url: "https://www.censtatd.gov.hk/api/get.php?id=635-93003&full_series=1&lang=en" },
    reply: {
      header: { status: { name: "Success", code: 0 } },
      dataSet: [
        { freq: "Y", period: "2025", sv: "HK_SEAFARER", svDesc: "Number", figure: 1210, sd_value: "" },
        { freq: "Y", period: "2025", sv: "HK_SEAFARER_AGREE", svDesc: "Number", figure: 582, sd_value: "" },
      ],
    },
    data: [
      { freq: "Y", period: "2025", sv: "HK_SEAFARER_AGREE", svDesc: "Number", indicatorDesc: "Employment agreements of HK registered seafarers", figure: 582, sd_value: "" },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 3600,
  },
  {
    tool: "airport_arrival_transit_passengers",
    input: { freq: "Q", period: "202606" },
    request: { url: "https://www.censtatd.gov.hk/api/get.php?id=650-93021&full_series=1&lang=en" },
    reply: {
      header: { status: { name: "Success", code: 0 } },
      dataSet: [
        { freq: "Q", period: "202603", sv: "AIRPORT_ARRIVAL_TRANSIT", svDesc: "Thousands", figure: 48, sd_value: "" },
        { freq: "Q", period: "202606", sv: "AIRPORT_ARRIVAL_TRANSIT", svDesc: "Thousands", figure: 52, sd_value: "p" },
      ],
    },
    data: [
      { freq: "Q", period: "202606", sv: "AIRPORT_ARRIVAL_TRANSIT", svDesc: "Thousands", indicatorDesc: "Arrival transits via Hong Kong Airport", figure: 52, sd_value: "p" },
    ],
    meta: { total: 1, returned: 1, truncated: false },
    ttl: 3600,
  },
  {
    name: "air_transport_capacity rejects a non-4-digit year period",
    tool: "air_transport_capacity",
    input: { period: "202506" },
    error: /period/,
  },
  {
    name: "shipping_port_cargo_throughput rejects a malformed period",
    tool: "shipping_port_cargo_throughput",
    input: { period: "2025-Q1" },
    error: /period/,
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

  it("reads today's flight board in Hong Kong time when no date is given", async () => {
    const { service, tool } = find("airport_departures");
    vi.useFakeTimers({ now: new Date("2026-10-18T16:30:00Z"), toFake: ["Date"] });
    fetchMock.mockImplementation(async () => new Response("[]"));
    try {
      const result = await executeTool(service, tool, {});
      expect(result.meta.source).toBe("https://www.hongkongairport.com/flightinfo-rest/rest/flights/past?arrival=false&cargo=false&lang=en&date=2026-10-19");
    } finally {
      vi.useRealTimers();
    }
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

  it("explains a cyclone id the Observatory has no track for", async () => {
    const { service, tool } = find("hko_cyclone_track");
    fetchMock.mockImplementation(async (url) =>
      String(url).endsWith("tc_list.xml") ? new Response("<TropicalCycloneList></TropicalCycloneList>") : new Response("<html>Not found</html>", { status: 404 }),
    );
    await expect(executeTool(service, tool, { id: 2602 })).rejects.toThrow(/no track for tropical cyclone 2602/);
  });

  it("reports a malformed taxi fleet payload", async () => {
    const { service, tool } = find("amigo_taxi_fleet");
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ unexpected: true })));
    await expect(executeTool(service, tool, {})).rejects.toMatchObject({ code: "upstream_parse" });
  });

  it("reports a malformed C&SD transport response without dataSet", async () => {
    const { service, tool } = find("air_cargo_movements");
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ header: { status: { code: 0, name: "Success" } } })));
    await expect(executeTool(service, tool, {})).rejects.toMatchObject({ code: "upstream_parse", message: expect.stringMatching(/dataSet/) });
  });

  it("reports a C&SD validation failure returned with HTTP 200", async () => {
    const { service, tool } = find("shipping_port_cargo_throughput");
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ header: { status: { name: "Fail", description: "Validation Fail" } }, error: { code: "E006", message: "Invalid Table ID" } })),
    );
    await expect(executeTool(service, tool, {})).rejects.toMatchObject({ code: "upstream_parse", message: expect.stringMatching(/Validation Fail/) });
  });
});
