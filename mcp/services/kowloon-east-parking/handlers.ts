import type { ResponseTransformer, ToolHandler } from "@/lib/mcp/types";

/**
 * The Smart Parking open data API nests prices and spaces under each vehicle
 * type, spells days as MON…SUN/PH lists and leaves out empty fields. These
 * turn it into flat, readable car parks, and join the live vacancies (which
 * only carry ids) with the car park names and spaces.
 */

const BASE_URL = "https://sps-opendata.pilotsmartke.gov.hk/rest";

/** Upstream languages; there is no Simplified Chinese, so sc gets Traditional. */
const LANGS: Record<string, string> = { en: "en_US", tc: "zh_TW", sc: "zh_TW" };

export const VEHICLE_TYPES = ["privateCar", "LGV", "HGV", "coach", "motorCycle"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

/** Upstream JSON; every field but the id and name may be missing. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Upstream = any;

function results(body: unknown): Upstream[] {
  // A filter that matches nothing returns `{}` instead of an empty list.
  const list = (body as { results?: unknown } | null)?.results;
  return Array.isArray(list) ? list : [];
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.replace(/\s+/g, " ").trim() : undefined;
}

function count(value: unknown) {
  return typeof value === "number" && value >= 0 ? value : undefined;
}

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_NAMES: Record<string, string> = { MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri", SAT: "Sat", SUN: "Sun", PH: "PH" };

/** ["MON", …, "FRI"], excludePublicHoliday → "Mon-Fri except PH"; every day → "Daily". */
export function days(weekdays: unknown, excludePublicHoliday?: unknown) {
  const list = Array.isArray(weekdays) ? weekdays.map(String) : [];
  const indexes = DAYS.map((day, index) => (list.includes(day) ? index : -1)).filter((index) => index >= 0);
  const runs: string[] = [];
  for (let start = 0; start < indexes.length; ) {
    let end = start;
    while (end + 1 < indexes.length && indexes[end + 1] === indexes[end] + 1) end++;
    const first = DAY_NAMES[DAYS[indexes[start]]];
    const last = DAY_NAMES[DAYS[indexes[end]]];
    if (end - start >= 2) runs.push(`${first}-${last}`);
    else runs.push(...indexes.slice(start, end + 1).map((index) => DAY_NAMES[DAYS[index]]));
    start = end + 1;
  }
  const label = indexes.length === 7 ? "Daily" : runs.join(", ");
  if (list.includes("PH") && indexes.length < 7) return [label, "PH"].filter(Boolean).join(", ");
  return excludePublicHoliday === true ? `${label} except PH` : label;
}

/** "00:00"–"24:00", or a period that starts and ends at the same time, is the whole day. */
function period(start: unknown, end: unknown) {
  if (typeof start !== "string" || typeof end !== "string") return undefined;
  return start === end || (start === "00:00" && end === "24:00") ? "24 hours" : `${start}-${end}`;
}

function when(rule: Upstream) {
  return { days: days(rule.weekdays, rule.excludePublicHoliday), hours: period(rule.periodStart, rule.periodEnd) };
}

export type Price = {
  type: string;
  price: number;
  days?: string;
  hours?: string;
  covered?: string;
  reserved?: string;
  minimumHours?: number;
  firstHours?: Array<{ hours: number; price: number }>;
  validUntil?: string;
  remark?: string;
};

function thresholds(rule: Upstream) {
  return Array.isArray(rule.usageThresholds) && rule.usageThresholds.length
    ? rule.usageThresholds.map((step: Upstream) => ({ hours: step.hours, price: step.price }))
    : undefined;
}

function price(rule: Upstream, type: string): Price {
  const result: Price = {
    type,
    price: rule.price,
    ...(rule.weekdays ? when(rule) : {}),
    covered: text(rule.covered),
    reserved: text(rule.reserved),
    minimumHours: count(rule.usageMinimum),
    firstHours: thresholds(rule),
    validUntil: rule.validUntil && rule.validUntil !== "no-restrictions" ? [rule.validUntil, rule.validUntilEnd].filter(Boolean).join(" ") : undefined,
    remark: text(rule.remark),
  };
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined)) as Price;
}

export type VehicleInfo = {
  spaces: number;
  evSpaces?: number;
  disabledSpaces?: number;
  unloadingSpaces?: number;
  prices?: Price[];
  offers?: Array<{ days: string; hours?: string; description: string }>;
};

function vehicle(record: Upstream): VehicleInfo | null {
  if (!record || !record.space) return null;
  const list = (key: string): Upstream[] => (Array.isArray(record[key]) ? record[key] : []);
  const prices = [
    ...list("hourlyCharges").map((rule) => price(rule, rule.type)),
    ...list("dayNightParks").map((rule) => price(rule, rule.type)),
    ...list("monthlyCharges").map((rule) => price(rule, rule.type)),
    ...list("unloadings").map((rule) => price(rule, `unloading-${rule.type}`)),
  ];
  const offers = list("privileges")
    .filter((rule) => text(rule.description))
    .map((rule) => ({ ...when(rule), description: text(rule.description)! }));
  return {
    spaces: record.space,
    ...(record.spaceEV ? { evSpaces: record.spaceEV } : {}),
    ...(record.spaceDIS ? { disabledSpaces: record.spaceDIS } : {}),
    ...(record.spaceUNL ? { unloadingSpaces: record.spaceUNL } : {}),
    ...(prices.length ? { prices } : {}),
    ...(offers.length ? { offers } : {}),
  };
}

export type Carpark = {
  id: number;
  name: string;
  nature?: string;
  type?: string;
  address?: string;
  area?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  openingHours?: string[];
  heightLimits?: Array<{ metres: number; remark?: string }>;
  gracePeriods?: Array<{ minutes: number; remark?: string }>;
  facilities?: string[];
  paymentMethods?: string[];
  remark?: string;
  vehicles: Partial<Record<VehicleType, VehicleInfo>>;
};

function carpark(record: Upstream, only: unknown): Carpark {
  const vehicles: Partial<Record<VehicleType, VehicleInfo>> = {};
  for (const type of VEHICLE_TYPES) {
    if (only && only !== type) continue;
    const info = vehicle(record[type]);
    if (info) vehicles[type] = info;
  }
  const [longitude, latitude] = Array.isArray(record.coordinates) ? record.coordinates : [];
  const result: Carpark = {
    id: record._id,
    name: text(record.name) ?? String(record._id),
    nature: record.nature,
    type: record.type,
    address: text(record.displayAddress),
    area: text(record.address?.subDistrict),
    district: text(record.address?.dcDistrict),
    latitude,
    longitude,
    phone: text(record.contactNo),
    website: text(record.website),
    openingHours: Array.isArray(record.openingHours) && record.openingHours.length ? record.openingHours.map((rule: Upstream) => [when(rule).days, when(rule).hours].filter(Boolean).join(" ")) : undefined,
    heightLimits: Array.isArray(record.heightLimits) && record.heightLimits.length
      ? record.heightLimits.map((limit: Upstream) => ({ metres: Number(limit.height), ...(text(limit.remark) ? { remark: text(limit.remark) } : {}) }))
      : undefined,
    gracePeriods: Array.isArray(record.gracePeriods) && record.gracePeriods.length
      ? record.gracePeriods.map((grace: Upstream) => ({ minutes: grace.minutes, ...(text(grace.remark) ? { remark: text(grace.remark) } : {}) }))
      : undefined,
    facilities: Array.isArray(record.facilities) && record.facilities.length ? record.facilities : undefined,
    paymentMethods: Array.isArray(record.paymentMethods) && record.paymentMethods.length ? record.paymentMethods : undefined,
    remark: text(record.remark),
    vehicles,
  };
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined)) as Carpark;
}

/** `getCarparkInfos?fullload=true` → flat car parks; with a vehicle type, only car parks with spaces for it, and only its prices. */
export const carparks: ResponseTransformer = (body, input) =>
  results(body)
    .map((record) => carpark(record, input.vehicleType))
    .filter((park) => !input.vehicleType || Object.keys(park.vehicles).length > 0);

// ---------------------------------------------------------------- live vacancies

export type Vacancy = { vacant: number | null; spaces?: number; ev?: number; disabled?: number; unloading?: number };

export type CarparkVacancy = {
  id: number;
  name: string;
  area?: string;
  district?: string;
  closed: boolean;
  updatedAt: string | null;
  vacancies: Partial<Record<VehicleType, Vacancy>>;
};

/**
 * Live vacancies for every car park, joined with the full car park list (the same request,
 * and cache entry, as `ke_carparks`) for names, areas and the number of spaces.
 */
export const vacancies: ToolHandler = async (input, context) => {
  const lang = LANGS[String(input.lang)] ?? LANGS.en;
  const [live, info] = await Promise.all([
    context.fetchUpstream(`${BASE_URL}/getCarparkVacancies`),
    context.fetchUpstream(`${BASE_URL}/getCarparkInfos?fullload=true&lang=${lang}`, { cacheTtl: 3600 }),
  ]);
  const parks = new Map(results(info).map((record) => [record._id, record]));
  return results(live)
    .filter((record) => input.carparkId === undefined || record._id === input.carparkId)
    .map((record): CarparkVacancy => {
      const park = parks.get(record._id) ?? {};
      const vacancies: Partial<Record<VehicleType, Vacancy>> = {};
      for (const type of VEHICLE_TYPES) {
        if (input.vehicleType && input.vehicleType !== type) continue;
        const live = record[type];
        if (!live) continue;
        const total = park[type]?.space;
        vacancies[type] = {
          vacant: count(live.vacancy) ?? null,
          ...(total ? { spaces: total } : {}),
          ...(count(live.vacancyEV) !== undefined ? { ev: live.vacancyEV } : {}),
          ...(count(live.vacancyDIS) !== undefined ? { disabled: live.vacancyDIS } : {}),
          ...(count(live.vacancyUNL) !== undefined ? { unloading: live.vacancyUNL } : {}),
        };
      }
      return {
        id: record._id,
        name: text(park.name) ?? `Car park ${record._id}`,
        ...(text(park.address?.subDistrict) ? { area: text(park.address.subDistrict) } : {}),
        ...(text(park.address?.dcDistrict) ? { district: text(park.address.dcDistrict) } : {}),
        closed: record.closed === true,
        updatedAt: typeof record.lastUploadDate === "string" ? record.lastUploadDate : null,
        vacancies,
      };
    })
    .filter((park) => Object.keys(park.vacancies).length > 0);
};
