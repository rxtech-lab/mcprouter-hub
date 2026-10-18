import type { ResponseTransformer, ToolHandler } from "@/lib/mcp/types";

/**
 * The Transport Department's traffic feeds are XML with upper-case field names,
 * codes instead of names (journey times) and English and Chinese side by side
 * (traffic news). These transformers return the same clean keys in every language.
 */

type Lang = "en" | "tc" | "sc";
type Names = Record<Lang, string>;

function language(value: unknown): Lang {
  return value === "tc" || value === "sc" ? value : "en";
}

/** XML lists with one element parse as an object, and empty ones as "". */
function items(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value;
  return value && typeof value === "object" ? [value as Record<string, unknown>] : [];
}

/** Trimmed text, or undefined for the empty elements the feeds use for "not applicable". */
function text(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed || undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** "2026-10-18T23:04:00" is Hong Kong time. */
function hongKongTime(value: unknown): string | undefined {
  const time = text(value);
  return time && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(time) ? `${time}+08:00` : time;
}

function matches(names: Array<string | undefined>, term: unknown) {
  if (typeof term !== "string" || !term.trim()) return true;
  const needle = term.trim().toLowerCase();
  return names.some((name) => name?.toLowerCase().includes(needle));
}

/** A sign or destination code given in full ("H1") picks that one only, not H11 as well. */
function matchesCode(code: string, names: Names | undefined, term: unknown, codes: Record<string, Names>) {
  if (typeof term === "string" && term.trim().toUpperCase() in codes) return code === term.trim().toUpperCase();
  return matches([code, ...Object.values(names ?? {})], term);
}

// ---------------------------------------------------------------- special traffic news (API-0024)

export type TrafficNews = {
  id: number | undefined;
  incidentNumber: string | undefined;
  status: "new" | "updated" | "closed" | undefined;
  heading: string | undefined;
  detail: string | undefined;
  location: string | undefined;
  district: string | undefined;
  direction: string | undefined;
  nearLandmark: string | undefined;
  betweenLandmark: string | undefined;
  announcedAt: string | undefined;
  content: string | undefined;
  latitude: number | undefined;
  longitude: number | undefined;
};

const NEWS_STATUSES: Record<string, TrafficNews["status"]> = { NEW: "new", UPDATED: "updated", CLOSED: "closed" };

/**
 * Every language's file carries both an `_EN` and a `_CN` copy of each field; the
 * Chinese copy is Traditional in the tc file and Simplified in the sc file.
 */
export const trafficNews: ResponseTransformer = (body, input) => {
  const suffix = language(input.lang) === "en" ? "EN" : "CN";
  const messages = items((body as { list?: { message?: unknown } })?.list?.message);
  return messages
    .map((message) => {
      const field = (name: string) => text(message[`${name}_${suffix}`]);
      return {
        id: number(message.ID),
        incidentNumber: text(message.INCIDENT_NUMBER),
        status: NEWS_STATUSES[String(message.INCIDENT_STATUS_EN ?? "").trim().toUpperCase()],
        heading: field("INCIDENT_HEADING"),
        detail: field("INCIDENT_DETAIL"),
        location: field("LOCATION"),
        district: field("DISTRICT"),
        direction: field("DIRECTION"),
        nearLandmark: field("NEAR_LANDMARK"),
        betweenLandmark: field("BETWEEN_LANDMARK"),
        announcedAt: hongKongTime(message.ANNOUNCEMENT_DATE),
        content: field("CONTENT"),
        latitude: number(message.LATITUDE),
        longitude: number(message.LONGITUDE),
      } satisfies TrafficNews;
    })
    .sort((a, b) => (b.announcedAt ?? "").localeCompare(a.announcedAt ?? ""));
};

// ---------------------------------------------------------------- journey time indicators (API-0025)

/** Where each indicator stands, from the Transport Department's data specification. */
export const INDICATORS: Record<string, Names> = {
  H1: { en: "Gloucester Road eastbound near Revenue Tower", tc: "告士打道東行近稅務大樓", sc: "告士打道东行近税务大楼" },
  H2: { en: "Canal Road Flyover northbound near exit of Aberdeen Tunnel", tc: "堅拿道天橋北行近香港仔隧道出口", sc: "坚拿道天桥北行近香港仔隧道出口" },
  H3: { en: "Island Eastern Corridor westbound near City Garden", tc: "東區走廊西行近城市花園", sc: "东区走廊西行近城市花园" },
  H4: { en: "Wong Nai Chung Road northbound near Queen's Road East", tc: "黃泥涌道北行近皇后大道東", sc: "黄泥涌道北行近皇后大道东" },
  H5: { en: "Hing Fat Street northbound near Victoria Park", tc: "興發街北行近維多利亞公園", sc: "兴发街北行近维多利亚公园" },
  H6: { en: "Repulse Bay Road northbound near Island Road", tc: "淺水灣道北行近香島道", sc: "浅水湾道北行近香岛道" },
  H7: { en: "Wong Chuk Hang Road northbound near the Hong Kong Country Club", tc: "黃竹坑道北行近香港鄉村俱樂部", sc: "黄竹坑道北行近香港乡村俱乐部" },
  H8: { en: "Wong Chuk Hang Road eastbound near Aberdeen Sports Ground", tc: "黃竹坑道東行近香港仔運動場", sc: "黄竹坑道东行近香港仔运动场" },
  H9: { en: "Ap Lei Chau Bridge Road northbound near Wong Chuk Hang Road", tc: "鴨脷洲橋道北行近黃竹坑道", sc: "鸭脷洲桥道北行近黄竹坑道" },
  H11: { en: "Island Eastern Corridor westbound near Lei King Wan", tc: "東區走廊西行近鯉景灣", sc: "东区走廊西行近鲤景湾" },
  K01: { en: "Ferry Street southbound near Charming Garden", tc: "渡船街南行近富榮花園", sc: "渡船街南行近富荣花园" },
  K02: { en: "Gascoigne Road eastbound near the Hong Kong Polytechnic University", tc: "加士居道東行近香港理工大學", sc: "加士居道东行近香港理工大学" },
  K03: { en: "Waterloo Road southbound near Kowloon Hospital", tc: "窩打老道南行近九龍醫院", sc: "窝打老道南行近九龙医院" },
  K04: { en: "Princess Margaret Road southbound near Oi Man Estate", tc: "公主道南行近愛民邨", sc: "公主道南行近爱民邨" },
  K05: { en: "Kai Fuk Road northbound near the petrol stations", tc: "啓福道北行近油站", sc: "启福道北行近油站" },
  K06: { en: "Chatham Road North southbound near Fat Kwong Street Playground", tc: "漆咸道北南行近佛光街遊樂場", sc: "漆咸道北南行近佛光街游乐场" },
  K07: { en: "West Kowloon Highway westbound near MTR Nam Cheong Station", tc: "西九龍公路西行近港鐵南昌站", sc: "西九龙公路西行近港铁南昌站" },
  K08: { en: "Kai Cheung Road westbound near Kowloon Bay Divisional Fire Station", tc: "啓祥道西行近九龍灣消防總局", sc: "启祥道西行近九龙湾消防总局" },
  N01: { en: "Hung Tin Road southbound near Hung Chi Road", tc: "洪天路南行近洪志路", sc: "洪天路南行近洪志路" },
  N02: { en: "Long Tin Road southbound near Parkside Villa", tc: "朗天路南行近柏麗豪園", sc: "朗天路南行近柏丽豪园" },
  N03: { en: "Yuen Long Highway eastbound near Shap Pat Heung Interchange", tc: "元朗公路東行近十八鄉交匯處", sc: "元朗公路东行近十八乡交汇处" },
  N05: { en: "Tai Po Road eastbound near Kwong Fuk Estate", tc: "大埔公路東行近廣福邨", sc: "大埔公路东行近广福邨" },
  N06: { en: "Tsing Sha Highway westbound near Shing Mun River Channel", tc: "青沙公路西行近城門河道", sc: "青沙公路西行近城门河道" },
  N07: { en: "Fuk Man Road northbound near Po Tung Road", tc: "福民路北行近普通道", sc: "福民路北行近普通道" },
  N08: { en: "Po Shun Road southbound near Chung Ming Court", tc: "寶順路南行近頌明苑", sc: "宝顺路南行近颂明苑" },
  N09: { en: "Wan Po Road westbound near Hong Kong Velodrome", tc: "環保大道西行近香港單車館", sc: "环保大道西行近香港单车馆" },
  N10: { en: "Po Hong Road southbound near KMB Tseung Kwan O Depot", tc: "寶康路南行近九巴將軍澳車廠", sc: "宝康路南行近九巴将军澳车厂" },
  N11: { en: "Po Yap Road westbound near Tiu Keng Leng Sports Centre", tc: "寶邑路西行近調景嶺體育館", sc: "宝邑路西行近调景岭体育馆" },
  N12: { en: "Po Shun Road southbound near Tiu Keng Leng Sports Centre", tc: "寶順路南行近調景嶺體育館", sc: "宝顺路南行近调景岭体育馆" },
  N13: { en: "Chui Ling Road eastbound near Tiu Keng Leng Sports Centre", tc: "翠嶺路東行近調景嶺體育館", sc: "翠岭路东行近调景岭体育馆" },
  SJ1: { en: "Tai Po Road southbound near Sha Tin Racecourse", tc: "大埔公路南行近沙田馬場", sc: "大埔公路南行近沙田马场" },
  SJ2: { en: "Tate's Cairn Highway southbound near Shek Mun", tc: "大老山隧道公路南行近石門", sc: "大老山隧道公路南行近石门" },
  SJ3: { en: "Tolo Highway southbound near the Science Park", tc: "吐露港公路南行近科學園", sc: "吐露港公路南行近科学园" },
  SJ4: { en: "San Tin Highway southbound near Fairview Park", tc: "新田公路南行近錦綉花園", sc: "新田公路南行近锦绣花园" },
  SJ5: { en: "Tuen Mun Road southbound near Tseng Choi Street", tc: "屯門公路南行近井財街", sc: "屯门公路南行近井财街" },
};

export const DESTINATIONS: Record<string, Names> = {
  CH: { en: "Cross Harbour Tunnel", tc: "紅磡海底隧道", sc: "红磡海底隧道" },
  EH: { en: "Eastern Harbour Crossing", tc: "東區海底隧道", sc: "东区海底隧道" },
  WH: { en: "Western Harbour Crossing", tc: "西區海底隧道", sc: "西区海底隧道" },
  ABT: { en: "Wan Chai via Aberdeen Tunnel", tc: "灣仔經香港仔隧道", sc: "湾仔经香港仔隧道" },
  WNCG: { en: "Wan Chai via Wong Nai Chung Gap Road", tc: "灣仔經黃泥涌峽道", sc: "湾仔经黄泥涌峡道" },
  PFL: { en: "Central via Pok Fu Lam Road", tc: "中區經薄扶林道", sc: "中区经薄扶林道" },
  ACTT: { en: "Airport via Route 3", tc: "機場經三號幹線", sc: "机场经三号干线" },
  TMCLK: { en: "Airport via Tuen Mun Chek Lap Kok Tunnel", tc: "機場經屯門赤鱲角隧道", sc: "机场经屯门赤鱲角隧道" },
  ATL: { en: "Airport via Tai Lam Tunnel", tc: "機場經大欖隧道", sc: "机场经大榄隧道" },
  ATSCA: { en: "Airport via Route 8", tc: "機場經八號幹線", sc: "机场经八号干线" },
  SSCPR: { en: "Sheung Shui via Castle Peak Road", tc: "上水經青山公路", sc: "上水经青山公路" },
  SSYLH: { en: "Sheung Shui via Route 9", tc: "上水經九號幹線", sc: "上水经九号干线" },
  LRT: { en: "Kowloon (Central) via Lion Rock Tunnel", tc: "九龍(中)經獅子山隧道", sc: "九龙(中)经狮子山隧道" },
  SMT: { en: "Tsuen Wan via Shing Mun Tunnel", tc: "荃灣經城門隧道", sc: "荃湾经城门隧道" },
  TCT: { en: "Kowloon (East) via Tate's Cairn Tunnel", tc: "九龍(東)經大老山隧道", sc: "九龙(东)经大老山隧道" },
  TKTL: { en: "Ting Kau via Tai Lam Tunnel", tc: "汀九經大欖隧道", sc: "汀九经大榄隧道" },
  TKTM: { en: "Ting Kau via Tuen Mun Road", tc: "汀九經屯門公路", sc: "汀九经屯门公路" },
  TLH: { en: "Sha Tin via Tolo Highway", tc: "沙田經吐露港公路", sc: "沙田经吐露港公路" },
  TPR: { en: "Sha Tin via Tai Po Road", tc: "沙田經大埔公路", sc: "沙田经大埔公路" },
  KTPR: { en: "Kowloon via Tai Po Road", tc: "九龍經大埔公路", sc: "九龙经大埔公路" },
  TSCA: { en: "Kowloon (West) via Route 8", tc: "九龍(西)經八號幹線", sc: "九龙(西)经八号干线" },
  TWCP: { en: "Tsuen Wan (West) via Castle Peak Road", tc: "荃灣(西)經青山公路", sc: "荃湾(西)经青山公路" },
  TWTM: { en: "Tsuen Wan (West) via Tuen Mun Road", tc: "荃灣(西)經屯門公路", sc: "荃湾(西)经屯门公路" },
  CWBR: { en: "Kowloon via Clear Water Bay Road", tc: "九龍經清水灣道", sc: "九龙经清水湾道" },
  MOS: { en: "Kowloon via Route 2", tc: "九龍經二號幹線", sc: "九龙经二号干线" },
  TKOLTT: { en: "Kowloon via Tseung Kwan O-Lam Tin Tunnel", tc: "九龍經將軍澳藍田隧道", sc: "九龙经将军澳蓝田隧道" },
  TKOT: { en: "Kowloon via Tseung Kwan O Tunnel", tc: "九龍經將軍澳隧道", sc: "九龙经将军澳隧道" },
};

const REGIONS: Record<string, Names> = {
  H: { en: "Hong Kong Island", tc: "香港島", sc: "香港岛" },
  K: { en: "Kowloon", tc: "九龍", sc: "九龙" },
  N: { en: "New Territories", tc: "新界", sc: "新界" },
};

/** Indicator codes start with their area: H(ong Kong Island), K(owloon), N(ew Territories); the SJ ones all stand in the New Territories. */
function indicatorRegion(code: string) {
  return REGIONS[code.startsWith("SJ") ? "N" : code[0]];
}

type Colour = "red" | "amber" | "green";
const COLOURS: Record<number, Colour> = { 1: "red", 2: "amber", 3: "green" };

/** What a sign shows instead of minutes (JOURNEY_TYPE 2); 4 is a blank sign. */
const SIGNS: Record<number, Names> = {
  1: { en: "Traffic congestion", tc: "交通擠塞", sc: "交通挤塞" },
  3: { en: "Tunnel closed", tc: "隧道封閉", sc: "隧道封闭" },
};

export type Journey = { destinationCode: string; destination: string; minutes: number | null; colour: Colour | null; notice?: string };
export type Indicator = { code: string; location: string; region: string | null; journeys: Journey[] };

export const journeyTimes: ResponseTransformer = (body, input) => {
  const lang = language(input.lang);
  const rows = items((body as { jtis_journey_list?: { jtis_journey_time?: unknown } })?.jtis_journey_list?.jtis_journey_time);
  const byCode = new Map<string, Indicator>();
  let capturedAt: string | undefined;
  for (const row of rows) {
    const code = text(row.LOCATION_ID);
    const destinationCode = text(row.DESTINATION_ID);
    if (!code || !destinationCode) continue;
    const location = INDICATORS[code];
    const destination = DESTINATIONS[destinationCode];
    if (!matchesCode(code, location, input.from, INDICATORS)) continue;
    if (!matchesCode(destinationCode, destination, input.to, DESTINATIONS)) continue;
    const time = hongKongTime(row.CAPTURE_DATE);
    if (time && (!capturedAt || time > capturedAt)) capturedAt = time;
    const isTime = row.JOURNEY_TYPE === 1;
    const data = number(row.JOURNEY_DATA);
    const notice = isTime ? undefined : ((data !== undefined ? SIGNS[data]?.[lang] : undefined) ?? text(row.JOURNEY_DESC));
    const indicator = byCode.get(code) ?? { code, location: location?.[lang] ?? code, region: indicatorRegion(code)?.[lang] ?? null, journeys: [] };
    indicator.journeys.push({
      destinationCode,
      destination: destination?.[lang] ?? destinationCode,
      minutes: isTime && data !== undefined && data >= 0 ? data : null,
      colour: COLOURS[number(row.COLOUR_ID) ?? -1] ?? null,
      ...(notice ? { notice } : {}),
    });
    byCode.set(code, indicator);
  }
  return { capturedAt: capturedAt ?? null, indicators: [...byCode.values()] };
};

// ---------------------------------------------------------------- traffic snapshot images (API-0026)

const CAMERA_FILES: Record<Lang, string> = { en: "En", tc: "Tc", sc: "Sc" };

const CAMERA_REGIONS: Record<string, Names> = {
  hongKongIsland: REGIONS.H,
  kowloon: REGIONS.K,
  newTerritories: REGIONS.N,
};

export type Camera = { key: string; region: string | undefined; district: string | undefined; description: string | undefined; latitude: number | undefined; longitude: number | undefined; imageUrl: string };

/** The camera list is the same file in three languages, named `_En`, `_Tc` and `_Sc`, so the path can't come from the YAML `lang` map. */
export const cameras: ToolHandler = async (input, context) => {
  const lang = language(input.lang);
  const body = await context.fetchUpstream(`https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_${CAMERA_FILES[lang]}.xml`, { format: "xml" });
  const region = typeof input.region === "string" ? CAMERA_REGIONS[input.region]?.[lang] : undefined;
  return items((body as { "image-list"?: { image?: unknown } })?.["image-list"]?.image)
    .map((image): Camera => {
      const key = String(image.key ?? "").trim();
      return {
        key,
        region: text(image.region),
        district: text(image.district),
        // Descriptions end in the camera key, e.g. "Aberdeen Praya Road near Fish Market [H429F]".
        description: text(image.description)?.replace(/\s*\[[^\]]*\]$/, ""),
        latitude: number(image.latitude),
        longitude: number(image.longitude),
        imageUrl: text(image.url) ?? `https://tdcctv.data.one.gov.hk/${key}.JPG`,
      };
    })
    .filter((camera) => camera.key && (!region || camera.region === region) && matches([camera.district], input.district));
};
