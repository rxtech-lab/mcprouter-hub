// Border control points MCP App: live queue status at the land crossings, and passenger and vehicle traffic.
import { h, mount, ui, type Content, type Row, type Tone, type View } from "../../apps/runtime";
import type { DailyControlPoint, QueueStatus, VehicleQuarter, WaitingTime } from "./handlers";

const TONES: Record<string, Tone | null> = { normal: "success", busy: "warning", very_busy: "danger", maintenance: null, closed: null, unknown: null };

const count = (value: number | null | undefined) => (value === null || value === undefined ? "—" : value.toLocaleString("en-HK"));

function queueChip(direction: string, queue: QueueStatus) {
  const chip = ui.chip(`${direction}: ${queue.label}`, TONES[queue.status]);
  if (queue.wait) chip.title = queue.wait;
  return chip;
}

function waiting(view: View) {
  const points: WaitingTime[] = view.data?.controlPoints ?? [];
  const busiest = points.filter((point) => [point.residents, point.visitors].some((group) => group.arrival.status === "very_busy" || group.departure.status === "very_busy"));
  return [
    ui.header({ badge: "⇄", title: "Border crossing queues", subtitle: `${points.length} land control points`, actions: [ui.refreshButton()] }),
    busiest.length ? ui.notice(`Very busy now: ${busiest.map((point) => point.name).join(", ")}`, "warning") : null,
    points.length
      ? ui.list(
          points.map((point) =>
            ui.row({
              leading: ui.badge(point.code),
              title: point.name,
              subtitle: h(
                "span",
                { class: "chips" },
                h("span", { class: "muted" }, "Residents"),
                queueChip("In", point.residents.arrival),
                queueChip("Out", point.residents.departure),
                h("span", { class: "muted" }, "Visitors"),
                queueChip("In", point.visitors.arrival),
                queueChip("Out", point.visitors.departure),
              ),
            }),
          ),
        )
      : ui.empty("No control point matches."),
    h("footer", { class: "footer" }, "Normal: residents usually wait under 15 min, visitors under 30 min. Busy: under 30 / 45 min."),
  ];
}

function daily(view: View) {
  const data: Row = view.data ?? {};
  const points: DailyControlPoint[] = data.controlPoints ?? [];
  const sorted = [...points].sort((a, b) => (b.arrival?.total ?? 0) + (b.departure?.total ?? 0) - ((a.arrival?.total ?? 0) + (a.departure?.total ?? 0)));
  return [
    ui.header({ badge: "⇄", title: `Passenger traffic on ${data.date ?? "—"}`, subtitle: data.latestDate && data.latestDate !== data.date ? `Latest day published: ${data.latestDate}` : null }),
    data.note ? ui.notice(data.note, "info") : null,
    data.total
      ? h(
          "div",
          { class: "stats" },
          h("div", { class: "stat" }, h("div", { class: "stat-label" }, "Arrivals"), h("div", { class: "stat-value" }, count(data.total.arrival?.total))),
          h("div", { class: "stat" }, h("div", { class: "stat-label" }, "Departures"), h("div", { class: "stat-value" }, count(data.total.departure?.total))),
        )
      : null,
    sorted.length
      ? ui.table(
          sorted.map((point) => ({
            "Control point": point.controlPoint,
            Arrivals: count(point.arrival?.total),
            Departures: count(point.departure?.total),
            "HK residents": count((point.arrival?.hongKongResidents ?? 0) + (point.departure?.hongKongResidents ?? 0)),
            "Mainland visitors": count((point.arrival?.mainlandVisitors ?? 0) + (point.departure?.mainlandVisitors ?? 0)),
            "Other visitors": count((point.arrival?.otherVisitors ?? 0) + (point.departure?.otherVisitors ?? 0)),
          })),
        )
      : null,
  ];
}

function annual(view: View) {
  const years: Row[] = view.data?.years ?? [];
  return [
    ui.header({ badge: "⇄", title: "Annual cross-boundary traffic", subtitle: "Million trips" }),
    ui.table(
      years.map((year) => ({
        Year: year.year,
        Passengers: year.passengerTrips,
        Air: year.passengerTripsByAir,
        Sea: year.passengerTripsBySea,
        Land: year.passengerTripsByLand,
        Visitors: year.visitorTrips,
        "Vehicles (Mainland)": year.vehicleTripsToAndFromMainland,
      })),
    ),
  ];
}

function passengers(view: View) {
  const rows: Row[] = Array.isArray(view.data) ? view.data : [];
  return [
    ui.header({ badge: "⇄", title: "Passengers cleared by Customs", subtitle: "Thousands per year" }),
    rows.length ? ui.table(rows.map((row) => ({ "Control point": row.controlPoint, Year: row.year, Passengers: count(row.passengersThousands) }))) : ui.empty("No control point matches."),
    rows.filter((row) => row.note).slice(0, 1).map((row) => ui.notice(`${row.controlPoint}: ${row.note}`, "info")),
    ui.footer(view),
  ];
}

function vehicles(view: View) {
  const rows: VehicleQuarter[] = Array.isArray(view.data) ? view.data : [];
  return [
    ui.header({ badge: "⇄", title: `Vehicles at land crossings${rows[0]?.year ? `, ${rows[0].year}` : ""}`, subtitle: "Thousands per quarter" }),
    rows.length
      ? ui.table(rows.map((row) => ({ "Control point": row.controlPoint, Quarter: `Q${row.quarter}`, Total: row.total, Goods: row.goodsVehicles, Passenger: row.passengerVehicles, "Private cars": row.privateCars })))
      : ui.empty("No figures match."),
    ui.footer(view),
  ];
}

const views: Record<string, (view: View) => Content> = {
  border_waiting_times: waiting,
  border_daily_passengers: daily,
  border_annual_traffic: annual,
  border_passenger_throughput: passengers,
  border_vehicle_throughput: vehicles,
};

mount({
  accent: "#00695c",
  render(view) {
    if (view.status === "loading") return [ui.header({ badge: "⇄", title: "Border control points", subtitle: "Checking the control points…" }), ui.skeleton(3)];
    const draw = view.tool ? views[view.tool] : undefined;
    return draw ? draw(view) : ui.generic(view.data);
  },
});
