import { cached } from "@/lib/mcp/cache";
import type { ResponseTransformer, ToolHandler, ToolInput } from "@/lib/mcp/types";

/**
 * The Immigration Department publishes queue status codes and CSVs whose
 * headers change with the language, so these handlers read columns by
 * position and return the same keys in every language.
 */

type Lang = "en" | "tc" | "sc";
type Names = Record<Lang, string>;

function language(value: unknown): Lang {
  return value === "tc" || value === "sc" ? value : "en";
}

/** Upstream CSV rows keyed by their (language-dependent) headers, as trimmed values in column order. Some files end lines in a bare CR. */
function cells(body: unknown): string[][] {
  if (!Array.isArray(body)) return [];
  return body.map((row) => Object.values(row as Record<string, unknown>).map((value) => String(value ?? "").trim()));
}

function number(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function matches(names: string[], term: unknown) {
  if (typeof term !== "string" || !term.trim()) return true;
  const needle = term.trim().toLowerCase();
  return names.some((name) => name.toLowerCase().includes(needle));
}

// ---------------------------------------------------------------- waiting times (API-0027)

const QUEUE_FEEDS = {
  residents: "https://secure1.info.gov.hk/immd/mobileapps/2bb9ae17/data/CPQueueTimeR.json",
  visitors: "https://secure1.info.gov.hk/immd/mobileapps/2bb9ae17/data/CPQueueTimeV.json",
} as const;

export const CONTROL_POINTS: Record<string, Names> = {
  LWS: { en: "Lo Wu", tc: "羅湖", sc: "罗湖" },
  LMC: { en: "Lok Ma Chau", tc: "落馬洲", sc: "落马洲" },
  LSC: { en: "Lok Ma Chau Spur Line", tc: "落馬洲支線", sc: "落马洲支线" },
  HGP: { en: "Huanggang", tc: "皇崗", sc: "皇岗" },
  MKT: { en: "Man Kam To", tc: "文錦渡", sc: "文锦渡" },
  STK: { en: "Sha Tau Kok", tc: "沙頭角", sc: "沙头角" },
  SBC: { en: "Shenzhen Bay", tc: "深圳灣", sc: "深圳湾" },
  HYW: { en: "Heung Yuen Wai", tc: "香園圍", sc: "香园围" },
  HZM: { en: "Hong Kong-Zhuhai-Macao Bridge", tc: "港珠澳大橋", sc: "港珠澳大桥" },
};

type Status = "normal" | "busy" | "very_busy" | "maintenance" | "closed" | "unknown";

const STATUSES: Record<number, Status> = { 0: "normal", 1: "busy", 2: "very_busy", 4: "maintenance", 99: "closed" };

const STATUS_NAMES: Record<Status, Names> = {
  normal: { en: "Normal", tc: "正常", sc: "正常" },
  busy: { en: "Busy", tc: "繁忙", sc: "繁忙" },
  very_busy: { en: "Very busy", tc: "非常繁忙", sc: "非常繁忙" },
  maintenance: { en: "System under maintenance", tc: "系統維修中", sc: "系统维修中" },
  closed: { en: "Outside service hours", tc: "非服務時間", sc: "非服务时间" },
  unknown: { en: "Unknown", tc: "未知", sc: "未知" },
};

/** Typical waits each status stands for, per the Immigration Department's data dictionary. Visitors wait longer. */
const WAITS: Record<"residents" | "visitors", Partial<Record<Status, Names>>> = {
  residents: {
    normal: { en: "generally under 15 min", tc: "一般少於 15 分鐘", sc: "一般少于 15 分钟" },
    busy: { en: "generally under 30 min", tc: "一般少於 30 分鐘", sc: "一般少于 30 分钟" },
    very_busy: { en: "generally 30 min or more", tc: "一般 30 分鐘或以上", sc: "一般 30 分钟或以上" },
  },
  visitors: {
    normal: { en: "generally under 30 min", tc: "一般少於 30 分鐘", sc: "一般少于 30 分钟" },
    busy: { en: "generally under 45 min", tc: "一般少於 45 分鐘", sc: "一般少于 45 分钟" },
    very_busy: { en: "generally 45 min or more", tc: "一般 45 分鐘或以上", sc: "一般 45 分钟或以上" },
  },
};

type Queue = { arrQueue?: number; depQueue?: number };
export type QueueStatus = { status: Status; label: string; wait: string | null };

function queueStatus(code: unknown, group: "residents" | "visitors", lang: Lang): QueueStatus {
  const status = typeof code === "number" ? (STATUSES[code] ?? "unknown") : "unknown";
  return { status, label: STATUS_NAMES[status][lang], wait: WAITS[group][status]?.[lang] ?? null };
}

export type WaitingTime = {
  code: string;
  name: string;
  residents: { arrival: QueueStatus; departure: QueueStatus };
  visitors: { arrival: QueueStatus; departure: QueueStatus };
};

export const waitingTimes: ToolHandler = async (input, context) => {
  const lang = language(input.lang);
  const [residents, visitors] = (await Promise.all([context.fetchUpstream(QUEUE_FEEDS.residents), context.fetchUpstream(QUEUE_FEEDS.visitors)])) as Array<Record<string, Queue>>;
  const codes = [...new Set([...Object.keys(CONTROL_POINTS), ...Object.keys(residents ?? {}), ...Object.keys(visitors ?? {})])];
  const controlPoints: WaitingTime[] = codes
    .filter((code) => residents?.[code] || visitors?.[code])
    .filter((code) => matches([code, ...Object.values(CONTROL_POINTS[code] ?? {})], input.controlPoint))
    .map((code) => ({
      code,
      name: CONTROL_POINTS[code]?.[lang] ?? code,
      residents: { arrival: queueStatus(residents?.[code]?.arrQueue, "residents", lang), departure: queueStatus(residents?.[code]?.depQueue, "residents", lang) },
      visitors: { arrival: queueStatus(visitors?.[code]?.arrQueue, "visitors", lang), departure: queueStatus(visitors?.[code]?.depQueue, "visitors", lang) },
    }));
  return { controlPoints };
};

// ---------------------------------------------------------------- Immigration Department statistics (API-2501, API-2503)

const IMMD_LANG: Record<Lang, string> = { en: "eng", tc: "hkt", sc: "hks" };

function immdCsv(file: string, lang: Lang) {
  return `https://www.immd.gov.hk/opendata/${IMMD_LANG[lang]}/transport/immigration_clearance/${file}.csv`;
}

type Passengers = { hongKongResidents: number | null; mainlandVisitors: number | null; otherVisitors: number | null; total: number | null };
export type DailyControlPoint = { controlPoint: string; arrival: Passengers | null; departure: Passengers | null };

const NO_PASSENGERS: Passengers = { hongKongResidents: 0, mainlandVisitors: 0, otherVisitors: 0, total: 0 };

function sum(rows: Array<Passengers | null>): Passengers {
  const add = (key: keyof Passengers) => rows.reduce((total, row) => total + (row?.[key] ?? 0), 0);
  return rows.length ? { hongKongResidents: add("hongKongResidents"), mainlandVisitors: add("mainlandVisitors"), otherVisitors: add("otherVisitors"), total: add("total") } : NO_PASSENGERS;
}

/** "17-10-2026" → "2026-10-17". */
function isoFromDayFirst(value: string) {
  const [day, month, year] = value.split(/[-/]/);
  return year && month && day ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` : value;
}

function dailyTable(rows: string[][], date: string | undefined, controlPoint: unknown) {
  const dates = rows.map((row) => isoFromDayFirst(row[0]));
  const latest = dates.reduce((max, value) => (value > max ? value : max), "");
  const first = dates.reduce((min, value) => (!min || value < min ? value : min), "");
  const day = date ?? latest;
  const byPoint = new Map<string, DailyControlPoint>();
  rows.forEach((row, index) => {
    if (dates[index] !== day) return;
    const [, name, direction, residents, mainland, other, total] = row;
    const entry = byPoint.get(name) ?? { controlPoint: name, arrival: null, departure: null };
    const figures = { hongKongResidents: number(residents), mainlandVisitors: number(mainland), otherVisitors: number(other), total: number(total) };
    // The direction column is "Arrival"/"Departure" in English and "入境"/"出境" in Chinese.
    if (/^(arr|入)/i.test(direction)) entry.arrival = figures;
    else entry.departure = figures;
    byPoint.set(name, entry);
  });
  const all = [...byPoint.values()];
  const controlPoints = all.filter((entry) => matches([entry.controlPoint], controlPoint));
  return {
    date: day,
    latestDate: latest || null,
    ...(all.length ? {} : { note: `No figures for ${day}. The data covers ${first} to ${latest}.` }),
    total: { arrival: sum(controlPoints.map((entry) => entry.arrival)), departure: sum(controlPoints.map((entry) => entry.departure)) },
    controlPoints,
  };
}

/**
 * The daily file holds every day since 2021 (several MB), more than the upstream cache keeps, so the
 * answer for each day and filter is cached instead of the file.
 */
export const dailyPassengers: ToolHandler = async (input, context) => {
  const lang = language(input.lang);
  const date = typeof input.date === "string" ? input.date : undefined;
  const key = `hk-border daily ${lang} ${date ?? "latest"} ${String(input.controlPoint ?? "").trim().toLowerCase()}`;
  return cached(key, context.tool.spec.cacheTtl ?? context.service.cacheTtl, async () => {
    const body = await context.fetchUpstream(immdCsv("statistics_on_daily_passenger_traffic", lang), { format: "csv", cacheTtl: 0 });
    return dailyTable(cells(body), date, input.controlPoint);
  });
};

export const annualTraffic: ToolHandler = async (input, context) => {
  const body = await context.fetchUpstream(immdCsv("statistics_passenger_visitor_vehicular_traffic", "en"), { format: "csv" });
  const years = cells(body)
    .map(([year, passengers, air, sea, land, vehicles, visitors]) => ({
      year: number(year),
      passengerTrips: number(passengers),
      passengerTripsByAir: number(air),
      passengerTripsBySea: number(sea),
      passengerTripsByLand: number(land),
      vehicleTripsToAndFromMainland: number(vehicles),
      visitorTrips: number(visitors),
    }))
    .filter((row) => row.year !== null && (input.year === undefined || row.year === input.year));
  return { unit: "million trips", years };
};

// ---------------------------------------------------------------- Customs and Excise Department statistics (API-1424, API-1427)

/** "Sha Tau Kok (Passenger clearance services … suspended …)" → the name and the note. */
function splitNote(value: string) {
  const match = /^(.*?)\s*[(（]([^()（）]{20,})[)）]\s*$/.exec(value);
  return match ? { controlPoint: match[1], note: match[2] } : { controlPoint: value };
}

const OVERALL = new Set(["OVERALL", "總計", "总计"]);

function controlPointName(value: string, lang: Lang) {
  return OVERALL.has(value) ? { en: "All control points", tc: "所有管制站", sc: "所有管制站" }[lang] : value;
}

export const customsPassengers: ResponseTransformer = (body, input) => {
  const lang = language(input.lang);
  return cells(body)
    .filter((row) => row[0])
    .map(([name, year, throughput]) => ({ ...splitNote(controlPointName(name, lang)), year: number(year), passengersThousands: number(throughput) }));
};

const VEHICLES: Record<string, "total" | "goodsVehicles" | "passengerVehicles" | "privateCars"> = {
  total: "total",
  總計: "total",
  总计: "total",
  "goods vehicles": "goodsVehicles",
  貨運車: "goodsVehicles",
  货运车: "goodsVehicles",
  "passenger vehicles": "passengerVehicles",
  客運車: "passengerVehicles",
  客运车: "passengerVehicles",
  "private cars": "privateCars",
  私家車: "privateCars",
  私家车: "privateCars",
};

export type VehicleQuarter = {
  controlPoint: string;
  year: number | null;
  quarter: number | null;
  total: number | null;
  goodsVehicles: number | null;
  passengerVehicles: number | null;
  privateCars: number | null;
};

/** One row per control point and quarter, with a column per vehicle type; only the asked (or latest) year. */
export const customsVehicles: ResponseTransformer = (body, input: ToolInput) => {
  const lang = language(input.lang);
  const rows = cells(body).filter((row) => row[0]);
  const latest = Math.max(...rows.map((row) => number(row[2]) ?? 0));
  const year = typeof input.year === "number" ? input.year : latest;
  const byKey = new Map<string, VehicleQuarter>();
  for (const [name, vehicle, rowYear, quarter, throughput] of rows) {
    if (number(rowYear) !== year) continue;
    const quarterNumber = number(/\d/.exec(quarter)?.[0]);
    const key = `${name} ${quarterNumber}`;
    const entry = byKey.get(key) ?? { controlPoint: controlPointName(name, lang), year, quarter: quarterNumber, total: null, goodsVehicles: null, passengerVehicles: null, privateCars: null };
    const column = VEHICLES[vehicle.toLowerCase()];
    if (column) entry[column] = number(throughput);
    byKey.set(key, entry);
  }
  return [...byKey.values()];
};
