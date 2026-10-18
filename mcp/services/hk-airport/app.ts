// Hong Kong International Airport MCP App: the departures and arrivals board for one day.
import { fmt, h, mount, ui, type Tone, type View } from "../../apps/runtime";
import type { Flight, FlightState } from "./handlers";

const TONES: Record<FlightState, Tone | null> = {
  scheduled: null,
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
  other: null,
};

/** "2026-10-18T00:05+08:00" → "00:05", read as written so it stays Hong Kong time. */
const clock = (value: string | undefined) => value?.slice(11, 16) ?? "";

const flightCount = (count: number) => `${count} flight${count === 1 ? "" : "s"}`;

function details(flight: Flight, arrival: boolean, day: string) {
  const airports = (arrival ? flight.origins : flight.destinations) ?? [];
  return [
    flight.scheduled.slice(0, 10) !== day ? `Scheduled ${fmt.day(flight.scheduled)}` : null,
    airports.length ? `${arrival ? "From" : "To"} ${airports.join(" · ")}` : null,
    flight.terminal ? flight.terminal : null,
    flight.aisle ? `Aisle ${flight.aisle}` : null,
    flight.gate ? `Gate ${flight.gate}` : null,
    flight.baggageBelt ? `Belt ${flight.baggageBelt}` : null,
    flight.hall ? `Hall ${flight.hall}` : null,
    flight.stand ? `Stand ${flight.stand}` : null,
    flight.codeshares?.length ? `Also ${flight.codeshares.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function board(view: View) {
  const arrival = view.tool === "airport_arrivals";
  const flights: Flight[] = Array.isArray(view.data) ? view.data : [];
  // Without a date the tool read today's board.
  const day: string = view.input?.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong" }).format(new Date());
  const cancelled = flights.filter((flight) => flight.state === "cancelled").length;
  const kind = view.input?.cargo ? (arrival ? "Cargo arrivals" : "Cargo departures") : arrival ? "Arrivals" : "Departures";
  return [
    ui.header({
      badge: "✈",
      title: `${kind} · ${fmt.day(`${day}T12:00+08:00`)}`,
      subtitle: `Hong Kong International Airport · ${flightCount(view.meta.total ?? flights.length)}`,
      actions: [ui.refreshButton()],
    }),
    cancelled ? ui.notice(`${flightCount(cancelled)} cancelled`, "warning") : null,
    flights.length
      ? ui.more(
          flights.map((flight) =>
            ui.row({
              leading: ui.badge(clock(flight.scheduled)),
              title: flight.flight,
              subtitle: details(flight, arrival, day),
              trailing: flight.status ? ui.chip(flight.status, TONES[flight.state]) : h("span", { class: "muted" }, "Scheduled"),
            }),
          ),
          30,
          "flights",
        )
      : ui.empty("No flight matches."),
    ui.footer(view),
  ];
}

mount({
  accent: "#00797f",
  render(view) {
    if (view.status === "loading") return [ui.header({ badge: "✈", title: "Hong Kong International Airport", subtitle: "Reading the flight board…" }), ui.skeleton(4)];
    return view.tool === "airport_departures" || view.tool === "airport_arrivals" ? board(view) : ui.generic(view.data);
  },
});
