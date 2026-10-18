import type { HandlerContext, ResponseTransformer, ToolHandler } from "@/lib/mcp/types";

/**
 * The Observatory's opendata.php answers `{ fields, data }` tables with no
 * station names, no high/low flags and no language, and answers a year it
 * has no predictions for with an HTML "invalid parameters" page. These
 * handlers name the stations, label the tides and say when a year is missing.
 */

type Lang = "en" | "tc" | "sc";
type Names = Record<Lang, string>;

function language(value: unknown): Lang {
  return value === "tc" || value === "sc" ? value : "en";
}

const OPENDATA = "https://data.weather.gov.hk/weatherAPI/opendata/opendata.php";

export const TIDE_STATIONS: Record<string, Names & { closed?: number }> = {
  CCH: { en: "Cheung Chau", tc: "長洲", sc: "长洲" },
  CLK: { en: "Chek Lap Kok (E)", tc: "赤鱲角(東)", sc: "赤鱲角(东)" },
  CMW: { en: "Chi Ma Wan", tc: "芝麻灣", sc: "芝麻湾", closed: 1997 },
  KCT: { en: "Kwai Chung", tc: "葵涌", sc: "葵涌" },
  KLW: { en: "Ko Lau Wan", tc: "高流灣", sc: "高流湾" },
  LOP: { en: "Lok On Pai", tc: "樂安排", sc: "乐安排", closed: 1999 },
  MWC: { en: "Ma Wan", tc: "馬灣", sc: "马湾" },
  PT1: { en: "Po Toi", tc: "蒲台", sc: "蒲台" },
  QUB: { en: "Quarry Bay", tc: "鰂魚涌", sc: "鰂鱼涌" },
  SPW: { en: "Shek Pik", tc: "石壁", sc: "石壁" },
  TAO: { en: "Tai O", tc: "大澳", sc: "大澳" },
  TBT: { en: "Tsim Bei Tsui", tc: "尖鼻咀", sc: "尖鼻咀" },
  TMW: { en: "Tai Miu Wan", tc: "大廟灣", sc: "大庙湾" },
  TPK: { en: "Tai Po Kau", tc: "大埔滘", sc: "大埔滘" },
  WAG: { en: "Waglan Island", tc: "橫瀾島", sc: "横澜岛" },
};

/** "Chek Lap Kok (E)" and "chek lap kok" both find CLK. */
const plain = (name: string) => name.toLowerCase().replace(/\s*[(（].*$/, "").trim();

function stationCode(value: unknown) {
  const term = plain(String(value ?? "QUB"));
  const code = Object.keys(TIDE_STATIONS).find((key) => key.toLowerCase() === term || [TIDE_STATIONS[key].en, TIDE_STATIONS[key].tc, TIDE_STATIONS[key].sc].some((name) => plain(name) === term));
  if (!code) throw new Error(`Unknown tide station "${String(value)}". Stations: ${Object.entries(TIDE_STATIONS).map(([key, names]) => `${key} (${names.en})`).join(", ")}`);
  return code;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Today's date in Hong Kong (UTC+8, no daylight saving). */
function hongKongToday(now = Date.now()) {
  return new Date(now + 8 * 3_600_000).toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

function dayCount(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

function isRealDate(date: string) {
  return !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().startsWith(date);
}

type Table = { fields: string[]; data: string[][] };

/** One year's table, or null when the Observatory has no data for that year (it answers with an HTML page). */
async function yearTable(context: HandlerContext, query: string, year: string): Promise<Table | null> {
  const text = String(await context.fetchUpstream(`${OPENDATA}?${query}&year=${year}&rformat=json`, { format: "text" }));
  try {
    const table = JSON.parse(text) as Table;
    return Array.isArray(table?.data) ? table : null;
  } catch {
    return null;
  }
}

function years(from: string, to: string) {
  const first = Number(from.slice(0, 4));
  return Array.from({ length: Number(to.slice(0, 4)) - first + 1 }, (_, index) => String(first + index));
}

function number(value: string | undefined) {
  if (!value || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// ---------------------------------------------------------------- predicted high and low tides (API-0032)

export type Tide = { time: string; type: "high" | "low"; heightM: number };
export type TideDay = { date: string; tides: Tide[] };

/** "0947" → "09:47". */
const clock = (value: string) => `${value.slice(0, 2)}:${value.slice(2, 4)}`;

/**
 * Rows are `[month, day, time, height, time, height, …]` with blanks for missing
 * turns. The feed doesn't say which turn is high and which low; they alternate,
 * so each is high when it stands above its neighbour.
 */
function tideTurns(table: Table, year: string) {
  const turns = table.data.flatMap(([month, day, ...pairs]) => {
    const date = `${year}-${pad(Number(month))}-${pad(Number(day))}`;
    const out: Array<{ date: string; time: string; heightM: number }> = [];
    for (let index = 0; index + 1 < pairs.length; index += 2) {
      const height = number(pairs[index + 1]);
      if (pairs[index] && height !== null) out.push({ date, time: clock(pairs[index]), heightM: height });
    }
    return out;
  });
  return turns.map((turn, index) => {
    const neighbour = turns[index + 1] ?? turns[index - 1];
    const type: Tide["type"] = neighbour && turn.heightM < neighbour.heightM ? "low" : "high";
    return { ...turn, type };
  });
}

export const tideTimes: ToolHandler = async (input, context) => {
  const lang = language(input.lang);
  const code = stationCode(input.station);
  const from = typeof input.date === "string" ? input.date : hongKongToday();
  if (!isRealDate(from)) throw new Error(`${from} is not a valid date`);
  const days = typeof input.days === "number" ? input.days : 1;
  const to = addDays(from, days - 1);
  const tables = await Promise.all(years(from, to).map(async (year) => [year, await yearTable(context, `dataType=HLT&station=${code}`, year)] as const));
  const missing = tables.filter(([, table]) => !table).map(([year]) => year);
  const turns = tables.flatMap(([year, table]) => (table ? tideTurns(table, year) : [])).filter((turn) => turn.date >= from && turn.date <= to);
  const byDate = new Map<string, Tide[]>();
  for (let offset = 0; offset < days; offset++) {
    const date = addDays(from, offset);
    if (!missing.includes(date.slice(0, 4))) byDate.set(date, []);
  }
  for (const { date, ...tide } of turns) byDate.get(date)?.push({ time: tide.time, type: tide.type, heightM: tide.heightM });
  const station = TIDE_STATIONS[code];
  const notes = [
    station.closed ? `${station.en} tide station closed in ${station.closed}; its predictions may have large errors.` : null,
    missing.length ? `The Observatory has no tide predictions for ${station.en} in ${missing.join(", ")}.` : null,
  ].filter(Boolean);
  return {
    station: { code, name: station[lang] },
    timeZone: "Asia/Hong_Kong",
    heightUnit: "metres above Chart Datum",
    ...(notes.length ? { note: notes.join(" ") } : {}),
    days: [...byDate].map(([date, tides]): TideDay => ({ date, tides })),
  };
};

// ---------------------------------------------------------------- sunrise, sunset, moonrise and moonset (API-0036)

export type SunMoonDay = {
  date: string;
  sunrise: string | null;
  sunTransit: string | null;
  sunset: string | null;
  moonrise: string | null;
  moonTransit: string | null;
  moonset: string | null;
};

const MAX_DAYS = 31;

/** Rows are `[YYYY-MM-DD, rise, transit, set]`; a blank means the event doesn't happen that day (common for the moon). */
function riseSet(tables: Array<Table | null>) {
  const byDate = new Map<string, [string | null, string | null, string | null]>();
  for (const table of tables) for (const [date, rise, transit, set] of table?.data ?? []) byDate.set(date, [rise || null, transit || null, set || null]);
  return byDate;
}

export const sunMoon: ToolHandler = async (input, context) => {
  const from = typeof input.date === "string" ? input.date : hongKongToday();
  const to = typeof input.endDate === "string" ? input.endDate : from;
  for (const date of [from, to]) if (!isRealDate(date)) throw new Error(`${date} is not a valid date`);
  if (to < from) throw new Error("endDate must not be before date");
  if (dayCount(from, to) > MAX_DAYS) throw new Error(`Ask for at most ${MAX_DAYS} days at a time`);
  const spanned = years(from, to);
  const [sun, moon] = await Promise.all(
    ["SRS", "MRS"].map(async (dataType) => riseSet(await Promise.all(spanned.map((year) => yearTable(context, `dataType=${dataType}`, year))))),
  );
  const days: SunMoonDay[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (!sun.has(date) && !moon.has(date)) continue;
    const [sunrise, sunTransit, sunset] = sun.get(date) ?? [null, null, null];
    const [moonrise, moonTransit, moonset] = moon.get(date) ?? [null, null, null];
    days.push({ date, sunrise, sunTransit, sunset, moonrise, moonTransit, moonset });
  }
  return {
    timeZone: "Asia/Hong_Kong",
    ...(days.length < dayCount(from, to) ? { note: `The Observatory has no sun and moon times for some of ${from} to ${to}; it publishes a few years ahead.` } : {}),
    days,
  };
};

// ---------------------------------------------------------------- latest observed sea levels (API-0032)

const NAME_TO_CODE = new Map(Object.entries(TIDE_STATIONS).flatMap(([code, names]) => [names.en, names.tc, names.sc].map((name) => [name, code] as const)));

export type TideObservation = { code: string | null; name: string; time: string | null; heightM: number | null };

/** CSV headers change with the language, so columns are read by position: station, date, time, height ("----" when missing). */
export const tideObservations: ResponseTransformer = (body) => {
  if (!Array.isArray(body)) return [];
  return body
    .map((row) => Object.values(row as Record<string, unknown>).map((value) => String(value ?? "").trim()))
    .filter(([name]) => name)
    .map(([name, date, time, height]): TideObservation => ({
      code: NAME_TO_CODE.get(name) ?? null,
      name,
      time: date && time ? `${date}T${time}:00+08:00` : null,
      heightM: number(height),
    }));
};
