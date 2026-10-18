import type { RequestTransformer, ResponseTransformer, ToolInput } from "@/lib/mcp/types";

/**
 * The Airport Authority's flight board answers with one group per scheduled
 * date (the asked day, plus flights from the days either side that depart or
 * arrive on it), each listing flights with their codeshares. These flatten the
 * groups into one row per flight and apply the local filters.
 */

/** Today in Hong Kong, as YYYY-MM-DD. */
export function hongKongToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong" }).format(now);
}

/** Fills in today (Hong Kong time) when no date was asked for. */
export const defaultDate: RequestTransformer = (request) => {
  const url = new URL(request.url);
  if (!url.searchParams.get("date")) url.searchParams.set("date", hongKongToday());
  return { ...request, url: url.toString() };
};

type Upstream = {
  date?: string;
  arrival?: boolean;
  cargo?: boolean;
  list?: Array<{
    time?: string;
    flight?: Array<{ no?: string; airline?: string }>;
    status?: string;
    destination?: string[];
    origin?: string[];
    terminal?: string;
    aisle?: string;
    gate?: string;
    baggage?: string;
    hall?: string;
    stand?: string;
  }>;
};

export type FlightState =
  | "scheduled"
  | "estimated"
  | "boarding_soon"
  | "boarding"
  | "final_call"
  | "gate_closed"
  | "departed"
  | "landed"
  | "at_gate"
  | "delayed"
  | "cancelled"
  | "other";

/** Status words in English, Traditional and Simplified Chinese. Longer phrases first: "Boarding Soon" before "Boarding". */
const STATES: Array<[RegExp, FlightState]> = [
  [/^(Est at|預計|预计)/i, "estimated"],
  [/^(Boarding Soon|預備登機|预备登机)/i, "boarding_soon"],
  [/^(Boarding|現正登機|现正登机)/i, "boarding"],
  [/^(Final Call|最後召集|最后召集)/i, "final_call"],
  [/^(Gate Closed|截止登機|截止登机)/i, "gate_closed"],
  [/^(Dep|啟航|启航)/i, "departed"],
  [/^(Landed|著陸|着陆)/i, "landed"],
  [/^(At gate|到閘口|到闸口)/i, "at_gate"],
  [/^(Delayed|延遲|延迟)/i, "delayed"],
  [/^(Cancelled|取消)/i, "cancelled"],
];

export type Flight = {
  scheduled: string;
  flight: string;
  airline: string | null;
  codeshares?: string[];
  destinations?: string[];
  origins?: string[];
  status: string | null;
  state: FlightState;
  /** When the status time (departed, landed, estimated…) is. */
  statusTime?: string;
  terminal?: string;
  aisle?: string;
  gate?: string;
  baggageBelt?: string;
  hall?: string;
  stand?: string;
};

function state(status: string): FlightState {
  if (!status) return "scheduled";
  return STATES.find(([pattern]) => pattern.test(status))?.[1] ?? "other";
}

/** "Dep 10:47 (18/10/2026)" → 2026-10-18T10:47; a time without a date is on the scheduled day. */
function statusTime(status: string, day: string) {
  const match = /(\d{2}:\d{2})(?:\s*\((\d{2})\/(\d{2})\/(\d{4})\))?/.exec(status);
  if (!match) return undefined;
  const [, time, dd, mm, yyyy] = match;
  return `${yyyy ? `${yyyy}-${mm}-${dd}` : day}T${time}+08:00`;
}

/** "cx 0261" → "CX261", so flight numbers match however they are typed. */
function flightKey(value: string) {
  const compact = value.toUpperCase().replace(/\s+/g, "");
  const match = /^([A-Z0-9]{2})0*(\d+[A-Z]?)$/.exec(compact);
  return match ? match[1] + match[2] : compact;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function flatten(body: unknown): Flight[] {
  if (!Array.isArray(body)) return [];
  return (body as Upstream[]).flatMap((group) =>
    (group.list ?? []).map((item) => {
      const [main, ...codeshares] = (item.flight ?? []).filter((flight) => flight.no);
      const status = item.status?.trim() ?? "";
      const day = group.date ?? "";
      const row: Flight = {
        scheduled: `${day}T${item.time ?? "00:00"}+08:00`,
        flight: main?.no ?? "",
        airline: main?.airline ?? null,
        ...(codeshares.length ? { codeshares: codeshares.map((flight) => flight.no!) } : {}),
        ...(item.destination ? { destinations: item.destination } : {}),
        ...(item.origin ? { origins: item.origin } : {}),
        status: status || null,
        state: state(status),
      };
      const time = statusTime(status, day);
      if (time) row.statusTime = time;
      // Passenger departures have terminal, check-in aisle and gate; arrivals baggage belt, hall and stand; cargo none.
      for (const [key, value] of [
        ["terminal", item.terminal],
        ["aisle", item.aisle],
        ["gate", item.gate],
        ["baggageBelt", item.baggage],
        ["hall", item.hall],
        ["stand", item.stand],
      ] as const) {
        const cleaned = text(value);
        if (cleaned) row[key] = cleaned;
      }
      return row;
    }),
  );
}

function matches(flight: Flight, input: ToolInput, date: string) {
  const numbers = [flight.flight, ...(flight.codeshares ?? [])];
  if (typeof input.flight === "string" && input.flight.trim()) {
    const wanted = flightKey(input.flight);
    if (!numbers.some((number) => flightKey(number) === wanted)) return false;
  }
  if (typeof input.airline === "string" && input.airline.trim()) {
    // A two-letter IATA code (CX) matches flight numbers, a three-letter ICAO code (CPA) the operating airline.
    const wanted = input.airline.trim().toUpperCase();
    if (!numbers.some((number) => number.toUpperCase().startsWith(`${wanted} `)) && flight.airline?.toUpperCase() !== wanted) return false;
  }
  if (typeof input.airport === "string" && input.airport.trim()) {
    const wanted = input.airport.trim().toUpperCase();
    if (![...(flight.destinations ?? []), ...(flight.origins ?? [])].some((code) => code.toUpperCase() === wanted)) return false;
  }
  if (typeof input.status === "string" && input.status.trim()) {
    const wanted = input.status.trim().toLowerCase();
    if (![flight.state.replace(/_/g, " "), flight.state, flight.status ?? ""].some((value) => value.toLowerCase().includes(wanted))) return false;
  }
  const time = flight.scheduled.slice(0, 16);
  if (typeof input.from === "string" && time < `${date}T${input.from}`) return false;
  if (typeof input.to === "string" && time > `${date}T${input.to}`) return false;
  return true;
}

/** One row per flight, filtered by flight number, airline, airport, status and scheduled time. */
export const flights: ResponseTransformer = (body, input) => {
  const date = typeof input.date === "string" && input.date ? input.date : hongKongToday();
  return flatten(body).filter((flight) => matches(flight, input, date));
};
