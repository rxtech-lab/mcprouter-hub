import type { ResponseTransformer, ToolHandler } from "@/lib/mcp/types";

/**
 * Sun Ferry has no route list, so its route codes (from its data dictionary)
 * are kept here. HKKF lists its routes but not its piers, which only come one
 * id at a time, so the six piers are kept here too.
 */

type Lang = "en" | "tc" | "sc";
type Names = Record<Lang, string>;
type Operator = "sunferry" | "hkkf";

function language(value: unknown): Lang {
  return value === "tc" || value === "sc" ? value : "en";
}

function matches(names: string[], term: unknown) {
  if (typeof term !== "string" || !term.trim()) return true;
  const needle = term.trim().toLowerCase();
  return names.some((name) => name.toLowerCase().includes(needle));
}

const OPERATORS: Record<Operator, Names> = {
  sunferry: { en: "Sun Ferry", tc: "新渡輪", sc: "新渡轮" },
  hkkf: { en: "Hong Kong & Kowloon Ferry", tc: "港九小輪", sc: "港九小轮" },
};

const SUN_FERRY_ETA = "https://www.sunferry.com.hk/eta/";
const HKKF = "https://www.hkkfeta.com/opendata";

/** "2026-10-18" plus `days`. */
function addDays(date: string, days: number) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

/** A Hong Kong date and "HH:MM" as an ISO timestamp. */
function hongKongTime(date: string, time: string) {
  return `${date}T${time.slice(0, 5)}:00+08:00`;
}

// ---------------------------------------------------------------- Sun Ferry (API-0020)

const PLACES = {
  central: { en: "Central", tc: "中環", sc: "中环" },
  cheungChau: { en: "Cheung Chau", tc: "長洲", sc: "长洲" },
  muiWo: { en: "Mui Wo", tc: "梅窩", sc: "梅窝" },
  pengChau: { en: "Peng Chau", tc: "坪洲", sc: "坪洲" },
  chiMaWan: { en: "Chi Ma Wan", tc: "芝麻灣", sc: "芝麻湾" },
  northPoint: { en: "North Point", tc: "北角", sc: "北角" },
  hungHom: { en: "Hung Hom", tc: "紅磡", sc: "红磡" },
  kowloonCity: { en: "Kowloon City", tc: "九龍城", sc: "九龙城" },
} satisfies Record<string, Names>;

type Place = keyof typeof PLACES;

/** Each code is one direction. The IIxxx codes are the inter-islands ferry. */
const SUN_FERRY_ROUTES: Record<string, [Place, Place]> = {
  CECC: ["central", "cheungChau"],
  CCCE: ["cheungChau", "central"],
  CEMW: ["central", "muiWo"],
  MWCE: ["muiWo", "central"],
  NPHH: ["northPoint", "hungHom"],
  HHNP: ["hungHom", "northPoint"],
  NPKC: ["northPoint", "kowloonCity"],
  KCNP: ["kowloonCity", "northPoint"],
  IIPECMUW: ["pengChau", "muiWo"],
  IIMUWPEC: ["muiWo", "pengChau"],
  IIMUWCMW: ["muiWo", "chiMaWan"],
  IICMWMUW: ["chiMaWan", "muiWo"],
  IICMWCHC: ["chiMaWan", "cheungChau"],
  IICHCCMW: ["cheungChau", "chiMaWan"],
  IICHCMUW: ["cheungChau", "muiWo"],
  IIMUWCHC: ["muiWo", "cheungChau"],
};

const INTER_ISLANDS: Names = { en: "Inter-islands", tc: "橫水渡", sc: "横水渡" };

function sunFerryRoute(code: string, lang: Lang): FerryRoute {
  const [from, to] = SUN_FERRY_ROUTES[code];
  return {
    operator: "sunferry",
    operatorName: OPERATORS.sunferry[lang],
    route: code,
    direction: null,
    from: PLACES[from][lang],
    to: PLACES[to][lang],
    ...(code.startsWith("II") ? { service: INTER_ISLANDS[lang] } : {}),
  };
}

type SunFerryEta = {
  routecode?: string;
  vesselcode?: string | null;
  depart_time?: string | null;
  eta?: string | null;
  lat?: string | null;
  lng?: string | null;
  rmk_en?: string | null;
  rmk_tc?: string | null;
  rmk_sc?: string | null;
};

export type Sailing = {
  direction: "outbound" | "inbound" | null;
  from: string;
  to: string;
  fromPier?: string;
  toPier?: string;
  departure: string;
  eta: string | null;
  status: "departed" | "scheduled";
  fast?: boolean;
  vessel?: string;
  position?: { lat: number; lng: number };
  remark?: string;
};

function remark(value: unknown) {
  return typeof value === "string" && value.trim() && value.trim() !== "[]" ? value.trim() : undefined;
}

/**
 * Sun Ferry gives bare "HH:MM" times. With an ETA the ferry has left, so a departure later than now was
 * yesterday's; without one it is the next scheduled sailing, so a departure earlier than now is tomorrow's.
 */
function sunFerrySailing(item: SunFerryEta, code: string, now: string, lang: Lang): Sailing | null {
  if (!item.depart_time) return null;
  const today = now.slice(0, 10);
  const clock = now.slice(11, 16);
  const departed = Boolean(item.eta);
  const departDay = departed ? (item.depart_time > clock ? addDays(today, -1) : today) : item.depart_time < clock ? addDays(today, 1) : today;
  const etaDay = item.eta && item.eta < item.depart_time ? addDays(departDay, 1) : departDay;
  const lat = Number(item.lat);
  const lng = Number(item.lng);
  const [from, to] = SUN_FERRY_ROUTES[code];
  return {
    direction: null,
    from: PLACES[from][lang],
    to: PLACES[to][lang],
    departure: hongKongTime(departDay, item.depart_time),
    eta: item.eta ? hongKongTime(etaDay, item.eta) : null,
    status: departed ? "departed" : "scheduled",
    // Fast ferries on a route answer under its code with an H suffix, e.g. CECCH.
    fast: item.routecode === `${code}H`,
    ...(item.vesselcode ? { vessel: item.vesselcode } : {}),
    ...(item.lat && item.lng && Number.isFinite(lat) && Number.isFinite(lng) ? { position: { lat, lng } } : {}),
    ...(remark(item[`rmk_${lang}`]) ? { remark: remark(item[`rmk_${lang}`]) } : {}),
  };
}

async function sunFerryArrivals(code: string, lang: Lang, fetchUpstream: (url: string) => Promise<unknown>) {
  if (!SUN_FERRY_ROUTES[code]) throw new Error(`Unknown Sun Ferry route ${code}. Routes are: ${Object.keys(SUN_FERRY_ROUTES).join(", ")}`);
  const body = (await fetchUpstream(`${SUN_FERRY_ETA}?route=${code}`)) as { generated_timestamp?: string; data?: SunFerryEta[] | null };
  const now = body?.generated_timestamp ?? new Date().toISOString();
  const route = sunFerryRoute(code, lang);
  return {
    operator: route.operatorName,
    route: code,
    name: `${route.from} – ${route.to}`,
    updatedAt: body?.generated_timestamp ?? null,
    sailings: (body?.data ?? []).map((item) => sunFerrySailing(item, code, now, lang)).filter((sailing): sailing is Sailing => sailing !== null),
  };
}

// ---------------------------------------------------------------- Hong Kong & Kowloon Ferry (API-0021)

const HKKF_PIERS: Record<number, Names & { lat: number; lng: number }> = {
  1: { en: "Central Pier 4", tc: "中環4號渡輪碼頭", sc: "中环4号渡轮码头", lat: 22.288007, lng: 114.158389 },
  2: { en: "Central Pier 6", tc: "中環6號渡輪碼頭", sc: "中环6号渡轮码头", lat: 22.287462, lng: 114.16033 },
  3: { en: "Yung Shue Wan Pier", tc: "榕樹灣渡輪碼頭", sc: "榕树湾渡轮码头", lat: 22.22652, lng: 114.109105 },
  4: { en: "Peng Chau Pier", tc: "坪洲渡輪碼頭", sc: "坪洲渡轮码头", lat: 22.284587, lng: 114.037164 },
  5: { en: "Sok Kwu Wan Pier 2", tc: "索罟灣公衆碼頭", sc: "索罟湾公众码头", lat: 22.206086, lng: 114.131543 },
  6: { en: "Hei Ling Chau Public Pier", tc: "喜靈洲碼頭", sc: "喜灵洲码头", lat: 22.2579923, lng: 114.0277868 },
};

/** Origin and destination pier of each route. */
const HKKF_ROUTE_PIERS: Record<number, [number, number]> = { 1: [1, 5], 2: [1, 3], 3: [2, 4], 4: [4, 6] };

type HkkfRoute = {
  route_id: number;
  [key: string]: unknown;
};

const DIRECTIONS = ["outbound", "inbound"] as const;
type Direction = (typeof DIRECTIONS)[number];

export type FerryRoute = {
  operator: Operator;
  operatorName: string;
  route: string;
  direction: Direction | null;
  from: string;
  to: string;
  fromPier?: string;
  toPier?: string;
  service?: string;
};

/** Outbound sails from the route's origin to its destination, inbound back. */
function hkkfRoute(route: HkkfRoute, direction: Direction, lang: Lang): FerryRoute {
  const origin = String(route[`origin_${lang}`] ?? route.origin_en ?? "");
  const destination = String(route[`destination_${lang}`] ?? route.destination_en ?? "");
  const piers = (HKKF_ROUTE_PIERS[route.route_id] ?? []).map((id) => HKKF_PIERS[id]?.[lang]);
  const [fromPier, toPier] = direction === "outbound" ? piers : [...piers].reverse();
  return {
    operator: "hkkf",
    operatorName: OPERATORS.hkkf[lang],
    route: String(route.route_id),
    direction,
    from: direction === "outbound" ? origin : destination,
    to: direction === "outbound" ? destination : origin,
    ...(fromPier ? { fromPier } : {}),
    ...(toPier ? { toPier } : {}),
  };
}

async function hkkfRoutes(fetchUpstream: (url: string) => Promise<unknown>) {
  const body = (await fetchUpstream(`${HKKF}/route/`)) as { data?: HkkfRoute[] };
  return body?.data ?? [];
}

type HkkfEta = { route_id?: number; direction?: string; date?: string; session_time?: string; ETA?: string | null };

async function hkkfArrivals(routeId: string, direction: Direction | undefined, lang: Lang, fetchUpstream: (url: string, options?: { cacheTtl?: number }) => Promise<unknown>) {
  if (!/^\d+$/.test(routeId)) throw new Error(`HKKF routes are numbered, e.g. 1 for Central – Sok Kwu Wan; got ${routeId}`);
  const directions = direction ? [direction] : DIRECTIONS;
  const [replies, routes] = await Promise.all([
    Promise.all(directions.map((dir) => fetchUpstream(`${HKKF}/eta/${routeId}/${dir}`) as Promise<{ generated_timestamp?: string; data?: HkkfEta[] }>)),
    hkkfRoutes((url) => fetchUpstream(url, { cacheTtl: 86400 })),
  ]);
  const route = routes.find((item) => String(item.route_id) === routeId);
  if (!route) throw new Error(`Unknown HKKF route ${routeId}. Routes are: ${routes.map((item) => item.route_id).join(", ")}`);
  const sailings = replies.flatMap((reply, index) => {
    const { from, to, fromPier, toPier } = hkkfRoute(route, directions[index], lang);
    return (reply?.data ?? [])
      .filter((item) => item.date && item.session_time)
      .map((item): Sailing => ({
        direction: directions[index],
        from,
        to,
        ...(fromPier ? { fromPier } : {}),
        ...(toPier ? { toPier } : {}),
        departure: hongKongTime(item.date!, item.session_time!),
        eta: item.ETA ?? null,
        status: "departed",
      }));
  });
  const outbound = hkkfRoute(route, "outbound", lang);
  return {
    operator: OPERATORS.hkkf[lang],
    route: routeId,
    name: `${outbound.from} ⇄ ${outbound.to}`,
    updatedAt: replies[0]?.generated_timestamp ?? null,
    sailings: sailings.sort((a, b) => (a.eta ?? "").localeCompare(b.eta ?? "")),
  };
}

// ---------------------------------------------------------------- tools

function operatorOf(value: unknown, route: string): Operator {
  if (value === "sunferry" || value === "hkkf") return value;
  return /^\d+$/.test(route) ? "hkkf" : "sunferry";
}

export const routes: ToolHandler = async (input, context) => {
  const lang = language(input.lang);
  const wanted = input.operator === "sunferry" || input.operator === "hkkf" ? [input.operator] : (["sunferry", "hkkf"] as Operator[]);
  const list: FerryRoute[] = [];
  if (wanted.includes("sunferry")) list.push(...Object.keys(SUN_FERRY_ROUTES).map((code) => sunFerryRoute(code, lang)));
  if (wanted.includes("hkkf")) {
    const hkkf = await hkkfRoutes(context.fetchUpstream);
    list.push(...hkkf.flatMap((route) => DIRECTIONS.map((direction) => hkkfRoute(route, direction, lang))));
  }
  // Match the place names in every language, so "長洲" finds routes in an English answer too.
  const names = (route: FerryRoute) => {
    if (route.operator === "hkkf") return [route.from, route.to, route.fromPier ?? "", route.toPier ?? ""];
    const [from, to] = SUN_FERRY_ROUTES[route.route];
    return [route.route, ...Object.values(PLACES[from]), ...Object.values(PLACES[to])];
  };
  return { routes: list.filter((route) => matches(names(route), input.search)) };
};

export const arrivals: ToolHandler = async (input, context) => {
  const lang = language(input.lang);
  const route = String(input.route ?? "").trim().toUpperCase();
  const direction = input.direction === "outbound" || input.direction === "inbound" ? input.direction : undefined;
  return operatorOf(input.operator, route) === "hkkf"
    ? hkkfArrivals(route, direction, lang, context.fetchUpstream)
    : sunFerryArrivals(route, lang, context.fetchUpstream);
};

// ---------------------------------------------------------------- HKKF timetable and fares

/** "['06:40', '^22:40', '{ 03:40 }', '#🞁09:15', '']" → sailings with their remark marks. */
function sailingTimes(value: string | undefined) {
  return [...(value ?? "").matchAll(/'([^']*)'/g)]
    .map(([, raw]) => {
      const time = /(\d{1,2}):(\d{2})/.exec(raw);
      if (!time) return null;
      const rest = raw.replace(time[0], "");
      // Braces wrap the time; the timetable writes the triangle mark as 🞁, the remarks as ▲.
      const marks = [...rest.replace(/[{}\s]/g, "")].map((mark) => (mark === "🞁" ? "▲" : mark));
      if (/[{}]/.test(rest)) marks.push("{}");
      return { time: `${time[1].padStart(2, "0")}:${time[2]}`, ...(marks.length ? { marks } : {}) };
    })
    .filter((sailing) => sailing !== null);
}

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

/** The remarks are HTML spans, cut off mid-attribute at the start; one remark per span, or run together. */
export function timetableRemarks(value: string | undefined) {
  const text = (value ?? "")
    .replace(/^[^<>]*">/, "")
    .replace(/<[^>]*>/g, "\n")
    .replace(/&[a-z#0-9]+;/g, (entity) => ENTITIES[entity] ?? " ");
  return text
    .split(/\n|(?=[@^#*▲]\s|\{\s*\})/)
    .map((line) => line.trim())
    .filter((line) => line && !/^(remarks|備註|备注)\s*[:：]?$/i.test(line))
    .map((line) => {
      const mark = /^(\{\s*\}|[@^#*▲])\s*/.exec(line);
      return mark ? { mark: mark[1].replace(/\s/g, ""), text: line.slice(mark[0].length) } : { text: line };
    });
}

/** Upstream CSV rows keyed by their bilingual headers, as values in column order. */
function cells(body: unknown): string[][] {
  if (!Array.isArray(body)) return [];
  return body.map((row) => Object.values(row as Record<string, unknown>).map((value) => String(value ?? "").trim()));
}

export const hkkfTimetable: ResponseTransformer = (body, input) => {
  const lang = language(input.lang);
  const column = { en: 0, tc: 1, sc: 2 }[lang];
  const row = cells(body)[0];
  if (!row) return null;
  const [routeId, direction] = row;
  const origin = row[2 + column];
  const destination = row[5 + column];
  const outbound = direction !== "inbound";
  return {
    route: Number(routeId),
    direction,
    from: outbound ? origin : destination,
    to: outbound ? destination : origin,
    mondayToSaturday: sailingTimes(row[11]),
    sundayAndHolidays: sailingTimes(row[12]),
    remarks: timetableRemarks(row[8 + column]),
  };
};

function price(value: string | undefined) {
  if (value === undefined || value === "" || value === "--") return null;
  if (/free|免費/i.test(value)) return 0;
  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** "child (aged 3 or above but under 12)/小童(3歲或以上但12歲以下)": English, then Chinese (there is no simplified column). */
export const hkkfFares: ResponseTransformer = (body, input) => {
  const lang = language(input.lang);
  return cells(body)
    .filter((row) => row[0])
    .map(([type, weekday, holiday]) => {
      const slash = type.indexOf("/");
      const [en, zh] = slash < 0 ? [type, type] : [type.slice(0, slash), type.slice(slash + 1)];
      const ticket = lang === "en" ? en.replace(/_/g, " ").trim() : zh.trim();
      // Monthly and multi-ride tickets have one price.
      return holiday === undefined ? { ticket, price: price(weekday) } : { ticket, mondayToSaturday: price(weekday), sundayAndHolidays: price(holiday) };
    });
};
