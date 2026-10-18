import type { HandlerContext, RequestTransformer, ResponseTransformer, ToolHandler } from "@/lib/mcp/types";

/**
 * The Observatory's regional weather CSVs have headers that change with the
 * language, so these read columns by position and return the same keys in
 * every language. Times are Hong Kong time, as "202610182300".
 */

type Lang = "en" | "tc" | "sc";

function language(value: unknown): Lang {
  return value === "tc" || value === "sc" ? value : "en";
}

/** Upstream CSV rows keyed by their (language-dependent) headers, as trimmed values in column order. */
function cells(body: unknown): string[][] {
  if (!Array.isArray(body)) return [];
  return body.map((row) => Object.values(row as Record<string, unknown>).flat().map((value) => String(value ?? "").trim()));
}

/** "M" (missing), "N/A" and "Calm" read as null. */
function number(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** "202610182300" → "2026-10-18T23:00:00+08:00". */
function isoTime(value: string | undefined) {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(value ?? "");
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00+08:00` : null;
}

/** Feeds spell the same station "HK Observatory", "Hong Kong Observatory", "King's Park" or "King’s Park"; people type "Kings Park". */
function stationKey(name: string) {
  return name.toLowerCase().replace(/['’]/g, "").replace(/\bhong kong\b/g, "hk").replace(/\s+/g, " ").trim();
}

function matches(names: string[], term: unknown) {
  if (typeof term !== "string" || !term.trim()) return true;
  const needle = stationKey(term);
  return names.some((name) => stationKey(name).includes(needle));
}

function latest(times: Array<string | null>) {
  return times.reduce<string | null>((max, time) => (time && (!max || time > max) ? time : max), null);
}

// ---------------------------------------------------------------- CSV files

const SUFFIX: Record<Lang, string> = { en: "", tc: "_uc", sc: "_sc" };

/** The regional weather CSVs come in one file per language: name.csv, name_uc.csv and name_sc.csv. */
function csvUrl(file: string, lang: Lang) {
  return `https://data.weather.gov.hk/weatherAPI/hko_data/regional-weather/${file}${SUFFIX[lang]}.csv`;
}

/** Turns the `lang` query the YAML adds into the file name of that language. */
export const regionalCsv: RequestTransformer = (request) => {
  const url = new URL(request.url);
  const lang = language(url.searchParams.get("lang"));
  url.searchParams.delete("lang");
  url.pathname = url.pathname.replace(/\.csv$/, `${SUFFIX[lang]}.csv`);
  return { ...request, url: url.toString() };
};

function readCsv(context: HandlerContext, file: string, lang: Lang) {
  return context.fetchUpstream(csvUrl(file, lang), { format: "csv" }).then(cells);
}

// ---------------------------------------------------------------- rainfall (API-0030)

type HourlyRainfall = { obsTime?: string; hourlyRainfall?: Array<{ automaticWeatherStation?: string; automaticWeatherStationID?: string; value?: string; unit?: string }> };

export type RainfallStation = { station: string; id: string; rainfallMm: number | null };

export const hourlyRainfall: ResponseTransformer = (body, input) => {
  const feed = (body ?? {}) as HourlyRainfall;
  const stations: RainfallStation[] = (feed.hourlyRainfall ?? [])
    .map((item) => ({ station: item.automaticWeatherStation ?? "", id: item.automaticWeatherStationID ?? "", rainfallMm: number(item.value) }))
    .filter((item) => matches([item.station, item.id], input.station))
    .filter((item) => !input.rainingOnly || (item.rainfallMm ?? 0) > 0);
  return { observedAt: feed.obsTime ?? null, stations };
};

// ---------------------------------------------------------------- UV index (API-0034)

type UvLevel = "low" | "moderate" | "high" | "very_high" | "extreme";

const UV_LEVELS: Record<UvLevel, Record<Lang, string>> = {
  low: { en: "Low", tc: "低", sc: "低" },
  moderate: { en: "Moderate", tc: "中", sc: "中" },
  high: { en: "High", tc: "高", sc: "高" },
  very_high: { en: "Very high", tc: "甚高", sc: "甚高" },
  extreme: { en: "Extreme", tc: "極高", sc: "极高" },
};

function uvLevel(index: number): UvLevel {
  if (index < 3) return "low";
  if (index < 6) return "moderate";
  if (index < 8) return "high";
  if (index < 11) return "very_high";
  return "extreme";
}

export const uvIndex: ResponseTransformer = (body, input) => {
  const [time, value] = cells(body).at(-1) ?? [];
  const index = number(value);
  if (index === null) return { observedAt: isoTime(time), uvIndex: null, level: null, label: null };
  const level = uvLevel(index);
  return { observedAt: isoTime(time), uvIndex: index, level, label: UV_LEVELS[level][language(input.lang)] };
};

// ---------------------------------------------------------------- lightning (API-0035)

export type Lightning = {
  from: string | null;
  to: string | null;
  total: { cloudToGround: number | null; cloudToCloud: number | null };
  cloudToGroundByRegion: Array<{ region: string; count: number | null }>;
};

const TERRITORY = /territory|境內|境内/i;

/** One period ("202610172100-202610172159"), a row per lightning type and region; "Hong Kong territory" rows are the totals. */
export const lightning: ResponseTransformer = (body) => {
  const rows = cells(body).filter((row) => row[0]);
  const [from, to] = (rows[0]?.[0] ?? "").split("-");
  const result: Lightning = { from: isoTime(from), to: isoTime(to), total: { cloudToGround: null, cloudToCloud: null }, cloudToGroundByRegion: [] };
  for (const [, type, region, count] of rows) {
    // "Cloud-to-ground" / "雲對地" / "云对地" against "Cloud-to-cloud" / "雲間" / "云间".
    const toGround = /ground|地/i.test(type);
    if (TERRITORY.test(region)) result.total[toGround ? "cloudToGround" : "cloudToCloud"] = number(count);
    else if (toGround) result.cloudToGroundByRegion.push({ region, count: number(count) });
  }
  return result;
};

// ---------------------------------------------------------------- regional weather (API-0037)

export type StationWeather = {
  station: string;
  temperatureC?: number;
  humidityPercent?: number;
  pressureHpa?: number;
  windDirection?: string;
  windSpeedKmh?: number;
  gustKmh?: number;
};

/** Keeps the readings a station reported. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== "")) as T;
}

export const regionalWeather: ToolHandler = async (input, context) => {
  const lang = language(input.lang);
  const [temperature, humidity, pressure, wind] = await Promise.all(
    ["latest_1min_temperature", "latest_1min_humidity", "latest_1min_pressure", "latest_10min_wind"].map((file) => readCsv(context, file, lang)),
  );
  const byKey = new Map<string, StationWeather>();
  const station = (name: string) => {
    const key = stationKey(name);
    const entry = byKey.get(key) ?? { station: name };
    byKey.set(key, entry);
    return entry;
  };
  for (const [, name, value] of temperature) if (name) station(name).temperatureC = number(value) ?? undefined;
  for (const [, name, value] of humidity) if (name) station(name).humidityPercent = number(value) ?? undefined;
  for (const [, name, value] of pressure) if (name) station(name).pressureHpa = number(value) ?? undefined;
  // A calm reading is "Calm,Calm,<gust>": the direction and the speed both say Calm.
  for (const [, name, direction, speed, gust] of wind) {
    if (name) Object.assign(station(name), { windDirection: direction, windSpeedKmh: number(speed) ?? undefined, gustKmh: number(gust) ?? undefined });
  }
  const times = [temperature, humidity, pressure, wind].map((rows) => isoTime(rows[0]?.[0]));
  return {
    observedAt: latest(times),
    stations: [...byKey.values()].filter((entry) => matches([entry.station], input.station)).map(compact),
  };
};

// ---------------------------------------------------------------- heat stress (API-0038)

export type HeatStressStation = { station: string; heatIndex: number | null; wbgtC: number | null };

/** Each file holds the last 10 minutes; keeps each station's latest reading. */
function latestByStation(rows: string[][]) {
  const readings = new Map<string, { name: string; time: string; value: number | null }>();
  for (const [time, name, value] of rows) {
    if (!name) continue;
    const key = stationKey(name);
    const previous = readings.get(key);
    if (!previous || time >= previous.time) readings.set(key, { name, time, value: number(value) });
  }
  return readings;
}

export const heatStress: ToolHandler = async (input, context) => {
  const lang = language(input.lang);
  const [hkhi, wbgt] = await Promise.all([readCsv(context, "recent10_10min_hkhi", lang), readCsv(context, "recent10_60min_wbgt", lang)]);
  const heatIndex = latestByStation(hkhi);
  const globe = latestByStation(wbgt);
  const stations: HeatStressStation[] = [...new Set([...heatIndex.keys(), ...globe.keys()])]
    .map((key) => ({ station: heatIndex.get(key)?.name ?? globe.get(key)!.name, heatIndex: heatIndex.get(key)?.value ?? null, wbgtC: globe.get(key)?.value ?? null }))
    .filter((entry) => matches([entry.station], input.station));
  const times = [...heatIndex.values(), ...globe.values()].map((reading) => isoTime(reading.time));
  return { observedAt: latest(times), stations };
};
