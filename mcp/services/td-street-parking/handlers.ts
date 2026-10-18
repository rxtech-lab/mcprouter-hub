import Papa from "papaparse";
import { cached } from "@/lib/mcp/cache";
import type { HandlerContext, ToolHandler, ToolInput } from "@/lib/mcp/types";

/**
 * The Transport Department publishes each on-street parking dataset as two
 * CSVs: where the spaces are (with names in English, Traditional and
 * Simplified Chinese) and a live occupancy file keyed by space id. These
 * handlers join the two and count spaces per street, so answers stay small.
 */

type Lang = "en" | "tc" | "sc";
type Names = Record<Lang, string>;

function language(value: unknown): Lang {
  return value === "tc" || value === "sc" ? value : "en";
}

function number(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Upstream coordinates carry up to 15 decimals; 6 is about 10 cm. */
function coordinate(value: string | undefined) {
  const parsed = number(value);
  return parsed === null ? null : Math.round(parsed * 1e6) / 1e6;
}

/** The metered file's English names are in capitals: "CENTRAL & WESTERN" → "Central & Western". */
function titleCase(text: string) {
  if (text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/(^|[\s(\-/.])([a-z])/g, (_, before: string, letter: string) => before + letter.toUpperCase());
}

/** Reads one name column in all three languages; a few rows leave the Chinese columns empty. */
function names(row: Record<string, string>, column: string, shouted = false): Names {
  const raw = (row[column] ?? "").trim();
  const en = shouted ? titleCase(raw) : raw;
  return { en, tc: row[`${column}_tc`]?.trim() || en, sc: row[`${column}_sc`]?.trim() || en };
}

/** Lower case, with curly apostrophes straightened: the sensor file spells "Bride’s Pool Road". */
const fold = (text: string) => text.toLowerCase().replace(/[‘’]/g, "'");

function matches(values: Names[], term: unknown) {
  if (typeof term !== "string" || !term.trim()) return true;
  const needle = fold(term.trim());
  return values.some((value) => Object.values(value).some((name) => fold(name).includes(needle)));
}

const pad = (value: string | number) => String(value).padStart(2, "0");

/**
 * The location files start with the date they were made and a blank (or all-comma) line before
 * the header; the occupancy files start with the header.
 */
function table(text: unknown, header: string) {
  const body = String(text ?? "");
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(header));
  // "2026-10-17", or day first ("18-10-2026") as the sensor data dictionary has it.
  const stamp = start > 0 ? lines[0].replace(/,+$/, "").trim() : "";
  const dayFirst = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(stamp);
  const generated = dayFirst ? `${dayFirst[3]}-${pad(dayFirst[2])}-${pad(dayFirst[1])}` : stamp || null;
  const rows = Papa.parse<Record<string, string>>(lines.slice(Math.max(start, 0)).join("\n"), { header: true, skipEmptyLines: true }).data;
  return { generated, rows };
}

/** "10/18/2026 09:10:03 PM" (metered, month first) or "18/10/2026 20:39:8" (sensors, day first) → ISO in Hong Kong time. */
function isoTime(value: string | undefined, monthFirst: boolean) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{1,2}):(\d{1,2})(?: ?([AP]M))?$/i.exec(value?.trim() ?? "");
  if (!match) return null;
  const [, first, second, year, rawHour, minute, secondOfMinute, half] = match;
  const [month, day] = monthFirst ? [first, second] : [second, first];
  let hour = Number(rawHour) % (half ? 12 : 24);
  if (half?.toUpperCase() === "PM") hour += 12;
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(secondOfMinute)}+08:00`;
}

export type Status = "vacant" | "occupied" | "not_in_use" | "no_data";
type Occupancy = { status: Status; since: string | null };

export type Counts = { spaces: number; vacant: number; occupied: number; notInUse: number; noData: number };

function count(spaces: Array<{ status: Status }>): Counts {
  const counts: Counts = { spaces: spaces.length, vacant: 0, occupied: 0, notInUse: 0, noData: 0 };
  for (const space of spaces) {
    if (space.status === "vacant") counts.vacant++;
    else if (space.status === "occupied") counts.occupied++;
    else if (space.status === "not_in_use") counts.notInUse++;
    else counts.noData++;
  }
  return counts;
}

function latest(values: Array<string | null>) {
  return values.reduce<string | null>((max, value) => (value && (!max || value > max) ? value : max), null);
}

function distinct<T>(values: T[]) {
  return [...new Set(values)];
}

/** Metres between two points (haversine). */
function distance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

/** The space nearest the middle of a group, so the point lies on the street. */
function representative<T extends { latitude: number | null; longitude: number | null }>(spaces: T[]) {
  const placed = spaces.filter((space) => space.latitude !== null && space.longitude !== null);
  if (!placed.length) return { latitude: null, longitude: null };
  const lat = placed.reduce((total, space) => total + space.latitude!, 0) / placed.length;
  const lng = placed.reduce((total, space) => total + space.longitude!, 0) / placed.length;
  const nearest = placed.reduce((best, space) => (distance(lat, lng, space.latitude!, space.longitude!) < distance(lat, lng, best.latitude!, best.longitude!) ? space : best));
  return { latitude: nearest.latitude, longitude: nearest.longitude };
}

// ---------------------------------------------------------------- metered spaces (API-0028)

const METERED = {
  spaces: "https://resource.data.one.gov.hk/td/psiparkingspaces/spaceinfo/parkingspaces.csv",
  occupancy: "https://resource.data.one.gov.hk/td/psiparkingspaces/occupancystatus/occupancystatus.csv",
};

export type VehicleType = "car" | "goods" | "coach" | "disabled";

/** "A" is any vehicle other than medium and heavy goods vehicles, buses, motorcycles and cycles. */
const VEHICLES: Record<string, VehicleType> = { A: "car", G: "goods", C: "coach", D: "disabled" };

/** The data dictionary's operating periods; a leading digit (3D, 4Q, 7J…) keeps the same hours. */
const HOURS: Record<string, Names> = {
  A: { en: "Mon–Sat 08:00–24:00, except public holidays", tc: "星期一至六 08:00–24:00（公眾假期除外）", sc: "星期一至六 08:00–24:00（公众假期除外）" },
  B: { en: "Mon–Sat 08:00–20:00, except public holidays", tc: "星期一至六 08:00–20:00（公眾假期除外）", sc: "星期一至六 08:00–20:00（公众假期除外）" },
  D: { en: "Mon–Sat 08:00–24:00; Sun and public holidays 10:00–22:00", tc: "星期一至六 08:00–24:00；星期日及公眾假期 10:00–22:00", sc: "星期一至六 08:00–24:00；星期日及公众假期 10:00–22:00" },
  E: { en: "Daily 07:00–20:00", tc: "每日 07:00–20:00", sc: "每日 07:00–20:00" },
  F: { en: "Daily 08:00–21:00", tc: "每日 08:00–21:00", sc: "每日 08:00–21:00" },
  G: { en: "Daily 07:00–19:00", tc: "每日 07:00–19:00", sc: "每日 07:00–19:00" },
  H: { en: "Daily 08:00–20:00", tc: "每日 08:00–20:00", sc: "每日 08:00–20:00" },
  J: { en: "Daily 08:00–24:00", tc: "每日 08:00–24:00", sc: "每日 08:00–24:00" },
  N: { en: "Daily 19:00–24:00", tc: "每日 19:00–24:00", sc: "每日 19:00–24:00" },
  P: { en: "Mon–Sat 08:00–20:00; no parking on Sundays", tc: "星期一至六 08:00–20:00；星期日不准停車", sc: "星期一至六 08:00–20:00；星期日不准停车" },
  Q: { en: "Mon–Sat 08:00–20:00; Sun and public holidays 10:00–22:00", tc: "星期一至六 08:00–20:00；星期日及公眾假期 10:00–22:00", sc: "星期一至六 08:00–20:00；星期日及公众假期 10:00–22:00" },
  S: {
    en: "Mon–Fri 17:00–24:00 (no parking 08:00–17:00); Sat 08:00–24:00; Sun and public holidays 10:00–22:00",
    tc: "星期一至五 17:00–24:00（08:00–17:00 不准停車）；星期六 08:00–24:00；星期日及公眾假期 10:00–22:00",
    sc: "星期一至五 17:00–24:00（08:00–17:00 不准停车）；星期六 08:00–24:00；星期日及公众假期 10:00–22:00",
  },
  T: {
    en: "Mon–Fri 17:30–24:00; Sat 08:00–24:00; Sun and public holidays 10:00–22:00",
    tc: "星期一至五 17:30–24:00；星期六 08:00–24:00；星期日及公眾假期 10:00–22:00",
    sc: "星期一至五 17:30–24:00；星期六 08:00–24:00；星期日及公众假期 10:00–22:00",
  },
};

function hours(code: string, lang: Lang) {
  return HOURS[code.replace(/^\d/, "")]?.[lang] ?? null;
}

type MeteredSpace = {
  id: string;
  district: Names;
  subDistrict: Names;
  street: Names;
  section: Names;
  latitude: number | null;
  longitude: number | null;
  vehicleType: VehicleType;
  maxStayMinutes: number | null;
  operatingPeriod: string;
  hourlyRate: number | null;
  status: Status;
  since: string | null;
};

/** Pole ids from 90000 up are the Transport Department's internal test meters. */
const TEST_POLES = 90_000;

/**
 * The location file is ~5 MB (every metered space, in three languages), more than the upstream
 * cache keeps, so it is fetched uncached and callers cache their own (much smaller) answer.
 */
async function meteredSpaces(context: HandlerContext) {
  const [spacesText, occupancyText] = await Promise.all([
    context.fetchUpstream(METERED.spaces, { format: "text", cacheTtl: 0 }),
    context.fetchUpstream(METERED.occupancy, { format: "text" }),
  ]);
  const occupancy = new Map<string, Occupancy>();
  for (const row of table(occupancyText, "ParkingSpaceId").rows) {
    const status: Status = row.ParkingMeterStatus === "NU" ? "not_in_use" : row.OccupancyStatus === "V" ? "vacant" : row.OccupancyStatus === "O" ? "occupied" : "no_data";
    occupancy.set(row.ParkingSpaceId, { status, since: isoTime(row.OccupancyDateChanged, true) });
  }
  const { generated, rows } = table(spacesText, "PoleId");
  const spaces: MeteredSpace[] = rows
    .filter((row) => row.ParkingSpaceId && (number(row.PoleId) ?? 0) < TEST_POLES)
    .map((row) => {
      const minutes = number(row.TimeUnit);
      const price = number(row.PaymentUnit);
      return {
        id: row.ParkingSpaceId,
        district: names(row, "District", true),
        subDistrict: names(row, "SubDistrict", true),
        street: names(row, "Street", true),
        section: names(row, "SectionOfStreet", true),
        latitude: coordinate(row.Latitude),
        longitude: coordinate(row.Longitude),
        vehicleType: VEHICLES[(row.VehicleType ?? "").trim().toUpperCase()] ?? "car",
        maxStayMinutes: number(row.LPP),
        operatingPeriod: (row.OperatingPeriod ?? "").trim(),
        hourlyRate: minutes && price !== null ? Math.round((price * 60 * 100) / minutes) / 100 : null,
        ...(occupancy.get(row.ParkingSpaceId) ?? { status: "no_data", since: null }),
      };
    });
  return { listDate: generated, spaces };
}

function meteredFilter(input: ToolInput) {
  return (space: MeteredSpace) =>
    (input.vehicleType === undefined || space.vehicleType === input.vehicleType) &&
    matches([space.district, space.subDistrict], input.district) &&
    matches([space.street, space.section], input.street);
}

export type StreetSummary = Counts & {
  district: string;
  street: string;
  vehicleType: VehicleType;
  hours: string[];
  maxStayMinutes: number[];
  hourlyRate: number[];
  latitude: number | null;
  longitude: number | null;
  distanceMeters?: number;
};

/** Spaces grouped by district, street and vehicle type. */
function byStreet(spaces: MeteredSpace[]) {
  const groups = new Map<string, MeteredSpace[]>();
  for (const space of spaces) {
    const key = `${space.district.en}|${space.street.en}|${space.vehicleType}`;
    const group = groups.get(key);
    if (group) group.push(space);
    else groups.set(key, [space]);
  }
  return [...groups.values()];
}

function streetSummary(members: MeteredSpace[], lang: Lang): StreetSummary {
  return {
    district: members[0].district[lang],
    street: members[0].street[lang],
    vehicleType: members[0].vehicleType,
    ...count(members),
    hours: distinct(members.map((space) => hours(space.operatingPeriod, lang) ?? space.operatingPeriod)).filter(Boolean),
    maxStayMinutes: distinct(members.map((space) => space.maxStayMinutes).filter((value): value is number => value !== null)).sort((a, b) => a - b),
    hourlyRate: distinct(members.map((space) => space.hourlyRate).filter((value): value is number => value !== null)).sort((a, b) => a - b),
    ...representative(members),
  };
}

function byDistrict(spaces: MeteredSpace[], lang: Lang) {
  const groups = new Map<string, MeteredSpace[]>();
  for (const space of spaces) {
    const group = groups.get(space.district.en);
    if (group) group.push(space);
    else groups.set(space.district.en, [space]);
  }
  return [...groups.values()].map((members) => ({ district: members[0].district[lang], ...count(members) })).sort((a, b) => a.district.localeCompare(b.district));
}

const STREET_LIMIT = 60;

function inputKey(input: ToolInput, names: string[]) {
  return names.map((name) => String(input[name] ?? "").trim().toLowerCase()).join(" ");
}

export const meteredVacancy: ToolHandler = async (input, context) => {
  const lang = language(input.lang);
  const key = `td-street-parking vacancy ${lang} ${inputKey(input, ["district", "street", "vehicleType"])}`;
  return cached(key, context.tool.spec.cacheTtl ?? context.service.cacheTtl, async () => {
    const { listDate, spaces: all } = await meteredSpaces(context);
    const spaces = all.filter(meteredFilter(input));
    const narrowed = Boolean(String(input.district ?? "").trim() || String(input.street ?? "").trim());
    const streets = narrowed
      ? byStreet(spaces)
          .map((members) => streetSummary(members, lang))
          .sort((a, b) => b.vacant - a.vacant || a.street.localeCompare(b.street))
      : [];
    return {
      listDate,
      updated: latest(spaces.map((space) => space.since)),
      total: count(spaces),
      districts: byDistrict(spaces, lang),
      ...(narrowed ? { streetsMatched: streets.length, streets: streets.slice(0, STREET_LIMIT) } : {}),
    };
  });
};

export type MeteredSpaceRow = {
  id: string;
  district: string;
  street: string;
  section: string;
  vehicleType: VehicleType;
  status: Status;
  since: string | null;
  latitude: number | null;
  longitude: number | null;
  maxStayMinutes: number | null;
  hourlyRate: number | null;
  hours: string | null;
};

/** Space ids are the pole number and a letter: 10006A, 10006B, 1001A. */
const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, "en", { numeric: true });

export const meteredStreetSpaces: ToolHandler = async (input, context) => {
  const lang = language(input.lang);
  const key = `td-street-parking spaces ${lang} ${inputKey(input, ["street", "district", "vehicleType", "status"])}`;
  return cached(key, context.tool.spec.cacheTtl ?? context.service.cacheTtl, async () => {
    const { spaces } = await meteredSpaces(context);
    return spaces
      .filter(meteredFilter(input))
      .filter((space) => input.status === undefined || space.status === input.status)
      .sort((a, b) => a.district.en.localeCompare(b.district.en) || a.street.en.localeCompare(b.street.en) || a.section.en.localeCompare(b.section.en) || byId(a, b))
      .map(
        (space): MeteredSpaceRow => ({
          id: space.id,
          district: space.district[lang],
          street: space.street[lang],
          section: space.section[lang],
          vehicleType: space.vehicleType,
          status: space.status,
          since: space.since,
          latitude: space.latitude,
          longitude: space.longitude,
          maxStayMinutes: space.maxStayMinutes,
          hourlyRate: space.hourlyRate,
          hours: hours(space.operatingPeriod, lang),
        }),
      );
  });
};

const NEARBY_LIMIT = 30;

export const meteredNearby: ToolHandler = async (input, context) => {
  const lang = language(input.lang);
  const lat = Number(input.latitude);
  const lng = Number(input.longitude);
  const radius = Number(input.radius ?? 300);
  // About 11 m of rounding keeps nearby callers on one cached answer.
  const key = `td-street-parking nearby ${lang} ${lat.toFixed(4)} ${lng.toFixed(4)} ${radius} ${String(input.vehicleType ?? "")}`;
  return cached(key, context.tool.spec.cacheTtl ?? context.service.cacheTtl, async () => {
    const { spaces } = await meteredSpaces(context);
    const near = spaces
      .filter((space) => input.vehicleType === undefined || space.vehicleType === input.vehicleType)
      .filter((space) => space.latitude !== null && space.longitude !== null)
      .map((space) => ({ space, meters: distance(lat, lng, space.latitude!, space.longitude!) }))
      .filter(({ meters }) => meters <= radius);
    const meters = new Map(near.map(({ space, meters }) => [space, meters]));
    const streets = byStreet(near.map(({ space }) => space))
      .map((members) => {
        // Point at the nearest vacant space, else the nearest one.
        const closest = (pool: MeteredSpace[]) => pool.reduce<MeteredSpace | null>((best, space) => (!best || meters.get(space)! < meters.get(best)! ? space : best), null);
        const target = closest(members.filter((space) => space.status === "vacant")) ?? closest(members)!;
        return { ...streetSummary(members, lang), latitude: target.latitude, longitude: target.longitude, distanceMeters: Math.round(meters.get(target)!) };
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
    return {
      center: { latitude: lat, longitude: lng },
      radiusMeters: radius,
      updated: latest(near.map(({ space }) => space.since)),
      total: count(near.map(({ space }) => space)),
      streetsMatched: streets.length,
      streets: streets.slice(0, NEARBY_LIMIT),
    };
  });
};

// ---------------------------------------------------------------- non-metered spaces with sensors (API-3629)

const SENSORS = {
  spaces: "https://data.nmospiot.gov.hk/api/pvds/Download/parkingspace",
  occupancy: "https://data.nmospiot.gov.hk/api/pvds/Download/occupancystatus",
};

export type SensorSection = Counts & {
  site: string;
  district: string;
  street: string;
  section: string;
  vehicleType: VehicleType;
  latitude: number | null;
  longitude: number | null;
  updated: string | null;
};

export const sensorVacancy: ToolHandler = async (input, context) => {
  const lang = language(input.lang);
  const [spacesText, occupancyText] = await Promise.all([context.fetchUpstream(SENSORS.spaces, { format: "text" }), context.fetchUpstream(SENSORS.occupancy, { format: "text" })]);
  const occupancy = new Map<string, Occupancy>();
  for (const row of table(occupancyText, "FeatureID").rows) {
    const status: Status = row.OccupancyStatus === "V" ? "vacant" : row.OccupancyStatus === "O" ? "occupied" : row.OccupancyStatus === "NU" ? "not_in_use" : "no_data";
    occupancy.set(row.ParkingSpaceId, { status, since: isoTime(row.OccupancyDateChanged, false) });
  }
  const groups = new Map<string, Array<ReturnType<typeof sensorSpace>>>();
  function sensorSpace(row: Record<string, string>) {
    return {
      // "A101_CL_001": site A101, a car or light vehicle space.
      site: row.ParkingSpaceId.split("_")[0],
      district: names(row, "District"),
      street: names(row, "Street"),
      section: names(row, "SectionOfStreet"),
      vehicleType: VEHICLES[(row.VehicleType ?? "").trim().toUpperCase()] ?? "car",
      latitude: coordinate(row.Latitude),
      longitude: coordinate(row.Longitude),
      ...(occupancy.get(row.ParkingSpaceId) ?? { status: "no_data" as Status, since: null }),
    };
  }
  const { generated, rows } = table(spacesText, "FeatureID");
  for (const row of rows) {
    if (!row.ParkingSpaceId) continue;
    const space = sensorSpace(row);
    if (input.vehicleType !== undefined && space.vehicleType !== input.vehicleType) continue;
    if (!matches([space.district, space.street, space.section], input.search)) continue;
    const key = `${space.section.en}|${space.vehicleType}`;
    const group = groups.get(key);
    if (group) group.push(space);
    else groups.set(key, [space]);
  }
  const sections: SensorSection[] = [...groups.values()].map((members) => ({
    site: members[0].site,
    district: members[0].district[lang],
    street: members[0].street[lang],
    section: members[0].section[lang],
    vehicleType: members[0].vehicleType,
    ...count(members),
    ...representative(members),
    updated: latest(members.map((space) => space.since)),
  }));
  const all = [...groups.values()].flat();
  return { listDate: generated, total: count(all), sections };
};
