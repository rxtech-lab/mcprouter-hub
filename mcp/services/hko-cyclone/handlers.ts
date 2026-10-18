import { UpstreamError } from "@/lib/mcp/fetcher";
import type { HandlerContext, ToolHandler } from "@/lib/mcp/types";

/**
 * The Observatory lists the tropical cyclones it is tracking in `tc_list.xml`
 * and publishes one track file per cyclone, `hko_tctrack_{id}.xml`, in English
 * only (the list adds a Traditional Chinese name). Positions come as "22.30N" /
 * "114.17E" text, winds as "65km/h" (or "--" for an extratropical low) and times
 * in UTC; these handlers turn them into numbers and Hong Kong time, and add the
 * distance and bearing from Hong Kong.
 */

type Lang = "en" | "tc" | "sc";

function language(value: unknown): Lang {
  return value === "tc" || value === "sc" ? value : "en";
}

const LIST_URL = "https://www.weather.gov.hk/wxinfo/currwx/tc_list.xml";
const trackUrl = (id: number) => `https://www.weather.gov.hk/wxinfo/currwx/hko_tctrack_${id}.xml`;

/** The Observatory's headquarters, Tsim Sha Tsui. */
const HONG_KONG = { latitude: 22.3, longitude: 114.17 };

type Category =
  | "low_pressure_area"
  | "tropical_depression"
  | "tropical_storm"
  | "severe_tropical_storm"
  | "typhoon"
  | "severe_typhoon"
  | "super_typhoon"
  | "extratropical_low";

/** The Observatory's intensity categories, as spelled in the track files. */
const CATEGORIES: Record<string, { category: Category; names: Record<Lang, string> }> = {
  "low pressure area": { category: "low_pressure_area", names: { en: "Low Pressure Area", tc: "低壓區", sc: "低压区" } },
  "tropical depression": { category: "tropical_depression", names: { en: "Tropical Depression", tc: "熱帶低氣壓", sc: "热带低气压" } },
  "tropical storm": { category: "tropical_storm", names: { en: "Tropical Storm", tc: "熱帶風暴", sc: "热带风暴" } },
  "severe tropical storm": { category: "severe_tropical_storm", names: { en: "Severe Tropical Storm", tc: "強烈熱帶風暴", sc: "强烈热带风暴" } },
  typhoon: { category: "typhoon", names: { en: "Typhoon", tc: "颱風", sc: "台风" } },
  "severe typhoon": { category: "severe_typhoon", names: { en: "Severe Typhoon", tc: "強颱風", sc: "强台风" } },
  "super typhoon": { category: "super_typhoon", names: { en: "Super Typhoon", tc: "超強颱風", sc: "超强台风" } },
  "extratropical low": { category: "extratropical_low", names: { en: "Extratropical Low", tc: "溫帶氣旋", sc: "温带气旋" } },
};

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

type Xml = Record<string, unknown>;

/** fast-xml-parser gives one element as an object and several as an array. */
function many(value: unknown): Xml[] {
  if (value === undefined || value === null || value === "") return [];
  return (Array.isArray(value) ? value : [value]) as Xml[];
}

function text(value: unknown) {
  return value === undefined || value === null ? "" : String(value).trim();
}

/** "22.30N" → 22.3, "16.70S" → -16.7, "121.10E" → 121.1, "170.00W" → -170. */
function coordinate(value: unknown): number | null {
  const match = /^(\d+(?:\.\d+)?)\s*([NSEW])$/i.exec(text(value));
  if (!match) return null;
  const degrees = Number(match[1]);
  return /[SW]/i.test(match[2]) ? -degrees : degrees;
}

/** "145km/h" → 145; "--" (extratropical low) → null. */
function windKmh(value: unknown): number | null {
  const match = /(\d+(?:\.\d+)?)/.exec(text(value));
  return match ? Number(match[1]) : null;
}

/** "2026-09-30T18:00:00+00:00" → "2026-10-01T02:00:00+08:00". */
function hongKongTime(value: unknown): string | null {
  const date = new Date(text(value));
  if (isNaN(date.getTime())) return null;
  return `${new Date(date.getTime() + 8 * 3_600_000).toISOString().slice(0, 19)}+08:00`;
}

function radians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in km and the 16-point compass bearing of the position from Hong Kong. */
function fromHongKong(latitude: number, longitude: number) {
  const [lat1, lat2] = [radians(HONG_KONG.latitude), radians(latitude)];
  const deltaLat = lat2 - lat1;
  const deltaLon = radians(longitude - HONG_KONG.longitude);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const distanceKm = Math.round(2 * 6371 * Math.asin(Math.sqrt(a)));
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  const degrees = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return { distanceKm, bearing: COMPASS[Math.round(degrees / 22.5) % 16] };
}

export type TrackPoint = {
  time: string | null;
  category: Category | null;
  intensity: string | null;
  maximumWindKmh: number | null;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  bearing?: string;
};

function trackPoint(item: Xml, lang: Lang, withDistance: boolean): TrackPoint | null {
  const latitude = coordinate(item.Latitude);
  const longitude = coordinate(item.Longitude);
  if (latitude === null || longitude === null) return null;
  const known = CATEGORIES[text(item.Intensity).toLowerCase()];
  return {
    time: hongKongTime(item.Time),
    category: known?.category ?? null,
    intensity: known?.names[lang] ?? (text(item.Intensity) || null),
    maximumWindKmh: windKmh(item.MaximumWind),
    latitude,
    longitude,
    ...(withDistance ? fromHongKong(latitude, longitude) : {}),
  };
}

type Listed = { id: number; name: string; chineseName: string | null };

async function currentCyclones(context: HandlerContext): Promise<Listed[]> {
  const body = (await context.fetchUpstream(LIST_URL, { format: "xml" })) as Xml;
  const list = (body?.TropicalCycloneList ?? {}) as Xml;
  return many(list.TropicalCyclone)
    .map((item) => ({ id: Number(text(item.TropicalCycloneID)), name: text(item.TropicalCycloneEnglishName), chineseName: text(item.TropicalCycloneChineseName) || null }))
    .filter((item) => Number.isInteger(item.id) && item.id > 0);
}

async function fetchTrack(id: number, context: HandlerContext): Promise<Xml> {
  try {
    const body = (await context.fetchUpstream(trackUrl(id), { format: "xml" })) as Xml;
    return (body?.TropicalCycloneTrack ?? {}) as Xml;
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 404) {
      throw new Error(`The Observatory has no track for tropical cyclone ${id}. Call hko_tropical_cyclones for the ids of the cyclones it is tracking now.`);
    }
    throw error;
  }
}

/** The display name: the Chinese name in Chinese when the list has one, and a localised category for an unnamed cyclone. */
function displayName(name: string, chineseName: string | null, lang: Lang) {
  if (lang !== "en" && chineseName) return chineseName;
  return CATEGORIES[name.toLowerCase()]?.names[lang] ?? name;
}

export type CycloneTrack = {
  id: number;
  name: string;
  englishName: string;
  chineseName: string | null;
  bulletinTime: string | null;
  current: TrackPoint | null;
  closestApproach: { time: string | null; distanceKm: number; bearing: string } | null;
  past: TrackPoint[];
  forecast: TrackPoint[];
};

function parseTrack(id: number, track: Xml, listed: Listed | undefined, lang: Lang): CycloneTrack {
  const report = (track.WeatherReport ?? {}) as Xml;
  const englishName = text(report.TropicalCycloneName) || listed?.name || String(id);
  const chineseName = listed?.chineseName ?? null;
  const current = many(report.AnalysisInformation).map((item) => trackPoint(item, lang, true))[0] ?? null;
  const past = many(report.PastInformation)
    .map((item) => trackPoint(item, lang, false))
    .filter((point): point is TrackPoint => point !== null);
  // Forecast positions without a time are interpolated, only there to draw a smooth line.
  const forecast = many(report.ForecastInformation)
    .filter((item) => text(item.Time))
    .map((item) => trackPoint(item, lang, true))
    .filter((point): point is TrackPoint => point !== null);
  const closest = [current, ...forecast].reduce<TrackPoint | null>((best, point) => (point && (!best || point.distanceKm! < best.distanceKm!) ? point : best), null);
  return {
    id,
    name: displayName(englishName, chineseName, lang),
    englishName,
    chineseName,
    bulletinTime: text((track.BulletinHeader as Xml | undefined)?.BulletinTime) || null,
    current,
    closestApproach: closest ? { time: closest.time, distanceKm: closest.distanceKm!, bearing: closest.bearing! } : null,
    past,
    forecast,
  };
}

const NONE = "The Hong Kong Observatory is not tracking any tropical cyclone right now.";

export type CycloneSummary = Omit<CycloneTrack, "past" | "forecast"> & { forecastPoints: number };

export const tropicalCyclones: ToolHandler = async (input, context) => {
  const lang = language(input.lang);
  const listed = await currentCyclones(context);
  if (!listed.length) return { cyclones: [], note: NONE };
  const tracks = await Promise.all(listed.map((item) => fetchTrack(item.id, context)));
  const cyclones: CycloneSummary[] = listed.map((item, index) => {
    const track = parseTrack(item.id, tracks[index], item, lang);
    return {
      id: track.id,
      name: track.name,
      englishName: track.englishName,
      chineseName: track.chineseName,
      bulletinTime: track.bulletinTime,
      current: track.current,
      closestApproach: track.closestApproach,
      forecastPoints: track.forecast.length,
    };
  });
  return { cyclones };
};

export const cycloneTrack: ToolHandler = async (input, context) => {
  const lang = language(input.lang);
  const id = typeof input.id === "number" ? input.id : undefined;
  // The list gives the Chinese name, and the id when none was asked for.
  const [track, listed] = await Promise.all([id ? fetchTrack(id, context) : undefined, currentCyclones(context)]);
  if (!id) {
    if (!listed.length) throw new Error(`${NONE} Pass the id of an earlier cyclone to read its last track.`);
    return parseTrack(listed[0].id, await fetchTrack(listed[0].id, context), listed[0], lang);
  }
  return parseTrack(id, track!, listed.find((item) => item.id === id), lang);
};
