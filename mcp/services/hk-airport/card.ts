// Hong Kong International Airport chat cards: the same flight board as app.ts, as a still picture.
import { blocks, card, fmt, truncation, type Card, type CardBuilder, type CardInput, type Tone } from "../../apps/card";
import type { Flight, FlightState } from "./handlers";

const ACCENT = "#00797f";

const TONES: Partial<Record<FlightState, Tone>> = {
  estimated: "info",
  boarding_soon: "accent",
  boarding: "accent",
  final_call: "warning",
  gate_closed: "warning",
  departed: "success",
  landed: "success",
  at_gate: "success",
  delayed: "warning",
  cancelled: "danger",
};

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong" }).format(new Date());

function details(flight: Flight, arrival: boolean) {
  const airports = (arrival ? flight.origins : flight.destinations) ?? [];
  return [
    airports.length ? `${arrival ? "From" : "To"} ${airports.join(" · ")}` : null,
    flight.gate ? `Gate ${flight.gate}` : null,
    flight.baggageBelt ? `Belt ${flight.baggageBelt}` : null,
    flight.codeshares?.length ? `Also ${flight.codeshares.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function board(result: CardInput): Card {
  const arrival = result.tool === "airport_arrivals";
  const flights: Flight[] = Array.isArray(result.data) ? result.data : [];
  const day: string = result.input?.date ?? today();
  const cancelled = flights.filter((flight) => flight.state === "cancelled").length;
  const kind = result.input?.cargo ? (arrival ? "Cargo arrivals" : "Cargo departures") : arrival ? "Arrivals" : "Departures";
  return {
    accent: ACCENT,
    badge: "✈",
    title: `${kind} · ${fmt.day(`${day}T12:00+08:00`)}`,
    subtitle: `Hong Kong International Airport · ${fmt.plural(result.meta.total ?? flights.length, "flight")}`,
    blocks: blocks(
      cancelled > 0 && card.notice(`${fmt.plural(cancelled, "flight")} cancelled`, "warning"),
      flights.length
        ? flights.slice(0, 12).map((flight) =>
            card.row({
              leading: { text: flight.scheduled.slice(11, 16) },
              title: flight.flight,
              subtitle: details(flight, arrival) || null,
              trailing: [{ text: flight.status ?? "Scheduled", tone: TONES[flight.state] ?? "neutral" }],
              muted: flight.state === "cancelled",
            }),
          )
        : card.text("No flight matches.", true),
    ),
    footer: truncation(result),
  };
}

export const buildCard: CardBuilder = (result) => (result.tool === "airport_departures" || result.tool === "airport_arrivals" ? board(result) : null);
