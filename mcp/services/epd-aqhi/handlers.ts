import type { ResponseTransformer } from "@/lib/mcp/types";

/**
 * The Environmental Protection Department publishes the AQHI as RSS whose
 * readings sit in free text ("Central/Western - General Stations: 3 Low - …"),
 * so these transformers parse the text and return the same keys in every
 * language.
 */

type Lang = "en" | "tc" | "sc";
type Names = Record<Lang, string>;

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

// ---------------------------------------------------------------- stations

export type StationType = "general" | "roadside";

/** The monitoring stations, so a station can be found by its name in any language. */
const STATIONS: Array<Names & { type: StationType }> = [
  { en: "Central/Western", tc: "中西區", sc: "中西区", type: "general" },
  { en: "Southern", tc: "南區", sc: "南区", type: "general" },
  { en: "Eastern", tc: "東區", sc: "东区", type: "general" },
  { en: "Kwun Tong", tc: "觀塘", sc: "观塘", type: "general" },
  { en: "Sham Shui Po", tc: "深水埗", sc: "深水埗", type: "general" },
  { en: "Kwai Chung", tc: "葵涌", sc: "葵涌", type: "general" },
  { en: "Tsuen Wan", tc: "荃灣", sc: "荃湾", type: "general" },
  { en: "Tseung Kwan O", tc: "將軍澳", sc: "将军澳", type: "general" },
  { en: "Yuen Long", tc: "元朗", sc: "元朗", type: "general" },
  { en: "Tuen Mun", tc: "屯門", sc: "屯门", type: "general" },
  { en: "Tung Chung", tc: "東涌", sc: "东涌", type: "general" },
  { en: "Tai Po", tc: "大埔", sc: "大埔", type: "general" },
  { en: "Sha Tin", tc: "沙田", sc: "沙田", type: "general" },
  { en: "North", tc: "北區", sc: "北区", type: "general" },
  { en: "Tap Mun", tc: "塔門", sc: "塔门", type: "general" },
  { en: "Causeway Bay", tc: "銅鑼灣", sc: "铜锣湾", type: "roadside" },
  { en: "Central", tc: "中環", sc: "中环", type: "roadside" },
  { en: "Mong Kok", tc: "旺角", sc: "旺角", type: "roadside" },
];

function namesOf(name: string) {
  const station = STATIONS.find((entry) => entry.en === name || entry.tc === name || entry.sc === name);
  return station ? [station.en, station.tc, station.sc] : [name];
}

function stationType(text: unknown): StationType {
  return /roadside|路邊|路边/i.test(String(text ?? "")) ? "roadside" : "general";
}

/**
 * Items whose station matches `term` in any language. An exact name wins over a partial one,
 * so "Central" is the roadside station and not also Central/Western.
 */
function matchStations<T>(items: T[], nameOf: (item: T) => string, term: unknown): T[] {
  if (typeof term !== "string" || !term.trim()) return items;
  const needle = term.trim().toLowerCase();
  const names = (item: T) => namesOf(nameOf(item)).map((name) => name.toLowerCase());
  const exact = items.filter((item) => names(item).includes(needle));
  return exact.length ? exact : items.filter((item) => names(item).some((name) => name.includes(needle)));
}

// ---------------------------------------------------------------- AQHI and health risk

export type RiskLevel = "low" | "moderate" | "high" | "very_high" | "serious";

const RISKS: Record<string, RiskLevel> = {
  low: "low",
  低: "low",
  moderate: "moderate",
  中: "moderate",
  high: "high",
  高: "high",
  "very high": "very_high",
  甚高: "very_high",
  serious: "serious",
  嚴重: "serious",
  严重: "serious",
};

/** AQHI 1-3 is low risk, 4-6 moderate, 7 high, 8-10 very high and 10+ serious. */
function riskOf(aqhi: number | null, plus = false): RiskLevel | null {
  if (aqhi === null) return null;
  if (plus || aqhi > 10) return "serious";
  if (aqhi >= 8) return "very_high";
  if (aqhi >= 7) return "high";
  if (aqhi >= 4) return "moderate";
  return "low";
}

/** "3" → 3, "10+" → 10 (and serious), anything else (a missing reading) → null. */
function parseAqhi(value: unknown) {
  const match = /^(\d+)(\+)?$/.exec(String(value ?? "").trim());
  if (!match) return { aqhi: null, risk: null };
  const aqhi = Number(match[1]);
  return { aqhi, risk: riskOf(aqhi, Boolean(match[2])) };
}

/** "Low to Moderate" or "低 至 中" → ["low", "moderate"]. */
function riskLevels(label: string): RiskLevel[] {
  return label
    .split(/\s+(?:to|至)\s+/i)
    .map((part) => RISKS[part.trim().toLowerCase()])
    .filter((level): level is RiskLevel => Boolean(level));
}

const MONTHS: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

/** "Sun, 18 Oct 2026 22:30:00 +0800" → "2026-10-18T22:30:00+08:00". */
function isoTime(value: unknown) {
  const match = /(\d{1,2}) ([A-Z][a-z]{2}) (\d{4}) (\d{2}):(\d{2})(?::(\d{2}))? ([+-]\d{2})(\d{2})/.exec(String(value ?? ""));
  if (!match || !MONTHS[match[2]]) return null;
  const [, day, month, year, hour, minute, second = "00", zoneHours, zoneMinutes] = match;
  return `${year}-${MONTHS[month]}-${day.padStart(2, "0")}T${hour}:${minute}:${second}${zoneHours}:${zoneMinutes}`;
}

type Item = Record<string, unknown>;
type Channel = { lastBuildDate?: string; item?: Item | Item[] };

function channel(body: unknown): Channel {
  return ((body as { rss?: { channel?: Channel } })?.rss?.channel ?? {}) as Channel;
}

// ---------------------------------------------------------------- current AQHI by station

export type StationReading = { station: string; type: StationType; aqhi: number | null; risk: RiskLevel | null; riskLabel: string | null };

/** "Central/Western - General Stations: 3 Low - Sun, 18 Oct 2026 22:30" → the type, index and risk. */
function parseReading(title: string, description: string): StationReading {
  const match = /^.*? - (.+?):\s*(\S+)\s+(.+?)\s+-\s+.*$/.exec(description.trim());
  const { aqhi, risk } = parseAqhi(match?.[2]);
  const label = match?.[3] ?? null;
  return { station: title, type: stationType(match?.[1] ?? description), aqhi, risk: (label && riskLevels(label)[0]) || risk, riskLabel: label };
}

export const currentAqhi: ResponseTransformer = (body, input) => {
  const feed = channel(body);
  const readings = asArray(feed.item).map((item) => parseReading(String(item.title ?? "").trim(), String(item.description ?? "")));
  const typed = readings.filter((reading) => !input.type || reading.type === input.type);
  return { updated: isoTime(feed.lastBuildDate), stations: matchStations(typed, (reading) => reading.station, input.station) };
};

// ---------------------------------------------------------------- range and forecast

export type RiskRange = { risk: string; riskLevels: RiskLevel[] };
export type AqhiRange = RiskRange & { aqhiMin: number | null; aqhiMax: number | null };
export type ForecastPeriod = { period: string; general: RiskRange | null; roadside: RiskRange | null };

/** The text lines of an RSS description: "<p>General Stations: 2 to 3 (Health Risk: Low)</p>…" → ["General Stations: 2 to 3 (Health Risk: Low)", …]. */
function lines(description: unknown) {
  return String(description ?? "")
    .split(/<\/?p\s*\/?>|<br\s*\/?>/i)
    .map((line) => line.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim())
    .filter(Boolean);
}

/** "General Stations: 2 to 3 (Health Risk: Low)" or "一般監測站: 2 to 3 (健康風險:低)". */
function currentRange(line: string): AqhiRange {
  const match = /:\s*(\S+)(?:\s+(?:to|至)\s+(\S+))?\s*[(（][^:：]*[:：]\s*(.+?)\s*[)）]\s*$/.exec(line);
  const min = parseAqhi(match?.[1]).aqhi;
  const max = match?.[2] ? parseAqhi(match[2]).aqhi : min;
  const risk = match?.[3] ?? "";
  return { aqhiMin: min, aqhiMax: max, risk, riskLevels: riskLevels(risk) };
}

/** "General Stations: Low to Moderate" → its risk range. */
function forecastRange(line: string): RiskRange {
  const risk = line.replace(/^[^:：]*[:：]\s*/, "").trim();
  return { risk, riskLevels: riskLevels(risk) };
}

export const aqhiForecast: ResponseTransformer = (body) => {
  const feed = channel(body);
  const [now, outlook] = asArray(feed.item);
  const current: { general: AqhiRange | null; roadside: AqhiRange | null } = { general: null, roadside: null };
  for (const line of lines(now?.description)) current[stationType(line)] = currentRange(line);

  const forecast: ForecastPeriod[] = [];
  for (const line of lines(outlook?.description)) {
    // Periods read "<Tomorrow A.M.>" or "<明天 上午>"; the station lines follow them.
    const period = /^<(.+)>$/.exec(line);
    if (period) forecast.push({ period: period[1].trim(), general: null, roadside: null });
    else if (forecast.length) forecast[forecast.length - 1][stationType(line)] = forecastRange(line);
  }
  return { updated: isoTime(feed.lastBuildDate), current, forecast };
};

// ---------------------------------------------------------------- past 24 hours

type HourlyItem = { type?: string; StationName?: string; DateTime?: string; aqhi?: unknown };
export type Hourly = { time: string | null; aqhi: number | null; risk: RiskLevel | null };
export type StationHistory = { station: string; type: StationType; highest: Hourly | null; readings: Hourly[] };

export const pastAqhi: ResponseTransformer = (body, input) => {
  const report = (body as { AQHI24HrReport?: { lastBuildDate?: string; item?: HourlyItem | HourlyItem[] } })?.AQHI24HrReport ?? {};
  const byStation = new Map<string, StationHistory>();
  for (const item of asArray(report.item)) {
    const name = String(item.StationName ?? "").trim();
    const entry = byStation.get(name) ?? { station: name, type: stationType(item.type), highest: null, readings: [] };
    entry.readings.push({ time: isoTime(item.DateTime), ...parseAqhi(item.aqhi) });
    byStation.set(name, entry);
  }
  const stations = matchStations([...byStation.values()], (entry) => entry.station, input.station).map((entry) => ({
    ...entry,
    highest: entry.readings.reduce<Hourly | null>((max, reading) => (reading.aqhi !== null && (!max || reading.aqhi >= (max.aqhi ?? 0)) ? reading : max), null),
  }));
  return { updated: isoTime(report.lastBuildDate), stations };
};
