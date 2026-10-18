import type { ToolHandler } from "@/lib/mcp/types";

/**
 * The Environmental Protection Department publishes the beach grading as one
 * RSS feed per language. Each item only carries the grade in its title
 * ("Repulse Bay Beach water quality was rated as Good(Grade 1)") and the
 * coordinates in an HTML table, so this handler reads those and returns the
 * same keys in every language.
 */

type Lang = "en" | "tc" | "sc";
type Names = Record<Lang, string>;

const LANGS: Lang[] = ["en", "tc", "sc"];

function language(value: unknown): Lang {
  return value === "tc" || value === "sc" ? value : "en";
}

const feedUrl = (lang: Lang) => `https://cd.epic.epd.gov.hk/beachpsi/${lang}/beach2.rss`;

const DISTRICTS = {
  islands: { en: "Islands", tc: "離島", sc: "离岛" },
  saiKung: { en: "Sai Kung", tc: "西貢", sc: "西贡" },
  southern: { en: "Southern", tc: "南區", sc: "南区" },
  taiPo: { en: "Tai Po", tc: "大埔", sc: "大埔" },
  tsuenWan: { en: "Tsuen Wan", tc: "荃灣", sc: "荃湾" },
  tuenMun: { en: "Tuen Mun", tc: "屯門", sc: "屯门" },
} satisfies Record<string, Names>;

/** The feed has no district, so it comes from the beach code in the item link (…/gradingreport/RB/). */
export const BEACH_DISTRICTS: Record<string, keyof typeof DISTRICTS> = {
  ANG: "tsuenWan", APP: "tsuenWan", CAS: "tsuenWan", HOM: "tsuenWan", LIDO: "tsuenWan", TK: "tsuenWan", TWM: "tsuenWan",
  B: "tuenMun", CP: "tuenMun", GB: "tuenMun", K: "tuenMun", NC: "tuenMun", OC: "tuenMun",
  BW: "southern", CHK: "southern", DW: "southern", MB: "southern", RB: "southern", SB: "southern", SM: "southern", SO: "southern", SST: "southern", TC: "southern",
  CSL: "islands", CSU: "islands", DB: "islands", HSY: "islands", KY: "islands", LSS: "islands", PO: "islands", SIL: "islands", TF: "islands", TW: "islands",
  CW1: "saiKung", CW2: "saiKung", HM: "saiKung", KT: "saiKung", SS: "saiKung", TRIO: "saiKung",
  LMN: "taiPo",
};

/** Grade 1-4 by the geometric mean of the last five E. coli counts: up to 24, 180, 610 and over 610 per 100 mL. */
const RATINGS: Record<number, Names> = {
  1: { en: "Good", tc: "良好", sc: "良好" },
  2: { en: "Fair", tc: "一般", sc: "一般" },
  3: { en: "Poor", tc: "差", sc: "差" },
  4: { en: "Very Poor", tc: "極差", sc: "极差" },
};

const CHINESE_DIGITS: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4 };

const MONTHS: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

/** "Fri, 16 Oct 2026 14:04:42" (Hong Kong time, no zone) → "2026-10-16T14:04:42+08:00". */
function isoDate(value: unknown): string | null {
  const match = /(\d{1,2}) (\w{3}) (\d{4}) (\d{2}:\d{2}:\d{2})/.exec(String(value ?? ""));
  if (!match || !MONTHS[match[2]]) return null;
  return `${match[3]}-${MONTHS[match[2]]}-${match[1].padStart(2, "0")}T${match[4]}+08:00`;
}

/** `22° 21' 53"` → 22.36472. */
function degrees([, deg, min, sec]: RegExpMatchArray) {
  return Math.round((Number(deg) + Number(min) / 60 + Number(sec) / 3600) * 1e5) / 1e5;
}

/** "Fair(Grade 2)" or "一般(二級)" at the end of the title → 2. */
function grade(title: string): number | null {
  const match = /\(\s*(?:Grade\s*)?([1-4一二三四])\s*(?:級|级)?\s*\)\s*$/i.exec(title);
  if (!match) return null;
  return CHINESE_DIGITS[match[1]] ?? Number(match[1]);
}

type Item = { title?: unknown; link?: unknown; description?: unknown; pubDate?: unknown };

type Parsed = { code: string; name: string; grade: number | null; title: string; latitude: number | null; longitude: number | null; report: string | null; updated: string | null };

function parseItem(item: Item): Parsed {
  const title = String(item.title ?? "").replace(/\s+/g, " ").trim();
  const link = typeof item.link === "string" ? item.link : null;
  const code = /gradingreport\/([^/?#]+)/.exec(link ?? "")?.[1] ?? "";
  const [lat, lon] = [...String(item.description ?? "").matchAll(/(\d+)°\s*(\d+)'\s*([\d.]+)"/g)];
  return {
    code,
    name: /^(.*?)\s*(?:water quality|的水質|的水质)/i.exec(title)?.[1] ?? title,
    grade: grade(title),
    title,
    latitude: lat ? degrees(lat) : null,
    longitude: lon ? degrees(lon) : null,
    report: link,
    updated: isoDate(item.pubDate),
  };
}

type Feed = { updated: string | null; beaches: Parsed[] };

function parseFeed(body: unknown): Feed {
  const channel = (body as { rss?: { channel?: { pubDate?: unknown; lastBuildDate?: unknown; item?: Item | Item[] } } })?.rss?.channel;
  const items = channel?.item === undefined ? [] : Array.isArray(channel.item) ? channel.item : [channel.item];
  return { updated: isoDate(channel?.lastBuildDate ?? channel?.pubDate), beaches: items.map(parseItem) };
}

export type Beach = {
  code: string;
  name: string;
  district: string | null;
  grade: number | null;
  rating: string | null;
  latitude: number | null;
  longitude: number | null;
  report: string | null;
  /** Only when the item was graded at another time than the rest of the feed. */
  updated?: string | null;
  /** The upstream title, when it carries no grade. */
  note?: string;
};

function matches(names: string[], term: unknown) {
  if (typeof term !== "string" || !term.trim()) return true;
  const needle = term.trim().toLowerCase();
  return names.some((name) => name.toLowerCase().includes(needle));
}

export const beachWaterQuality: ToolHandler = async (input, context) => {
  const lang = language(input.lang);
  // A name search may be in any language, so it reads all three feeds (each cached on its own).
  const langs = typeof input.beach === "string" && input.beach.trim() ? [lang, ...LANGS.filter((other) => other !== lang)] : [lang];
  const feeds = (await Promise.all(langs.map((each) => context.fetchUpstream(feedUrl(each), { format: "xml" })))).map(parseFeed);
  const namesByCode = new Map<string, string[]>();
  for (const feed of feeds) for (const beach of feed.beaches) namesByCode.set(beach.code, [...(namesByCode.get(beach.code) ?? []), beach.name]);
  const { updated, beaches } = feeds[0];

  const result: Beach[] = beaches
    .filter((beach) => matches([beach.code, ...(namesByCode.get(beach.code) ?? [])], input.beach))
    .filter((beach) => matches(Object.values(DISTRICTS[BEACH_DISTRICTS[beach.code]] ?? {}), input.district))
    .filter((beach) => input.grade === undefined || beach.grade === input.grade)
    .filter((beach) => input.maxGrade === undefined || (beach.grade !== null && beach.grade <= Number(input.maxGrade)))
    .map((beach) => {
      const district = BEACH_DISTRICTS[beach.code];
      return {
        code: beach.code,
        name: beach.name,
        district: district ? DISTRICTS[district][lang] : null,
        grade: beach.grade,
        rating: beach.grade ? RATINGS[beach.grade][lang] : null,
        latitude: beach.latitude,
        longitude: beach.longitude,
        report: beach.report,
        ...(beach.updated && beach.updated !== updated ? { updated: beach.updated } : {}),
        ...(beach.grade ? {} : { note: beach.title }),
      };
    });
  return { updated, count: result.length, beaches: result };
};
