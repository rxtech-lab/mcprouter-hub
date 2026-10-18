// Border control point chat cards: the same views as app.ts, as still pictures.
import { blocks, card, truncation, type Card, type CardBuilder, type CardInput, type Chip, type Row, type Tone } from "../../apps/card";
import type { DailyControlPoint, QueueStatus, VehicleQuarter, WaitingTime } from "./handlers";

const ACCENT = "#00695c";
const base = { accent: ACCENT, badge: "⇄" };

const TONES: Record<string, Tone> = { normal: "success", busy: "warning", very_busy: "danger" };

const count = (value: number | null | undefined) => (value === null || value === undefined ? "—" : value.toLocaleString("en-HK"));

const chip = (direction: string, queue: QueueStatus): Chip => ({ text: `${direction} ${queue.label}`, tone: TONES[queue.status] ?? "neutral" });

function waiting({ data = {} }: CardInput): Card {
  const points: WaitingTime[] = data.controlPoints ?? [];
  return {
    ...base,
    title: "Border crossing queues",
    subtitle: `${points.length} land control points`,
    blocks: points.length
      ? points.map((point) =>
          card.row({
            leading: { text: point.code },
            title: point.name,
            subtitle: `Visitors: in ${point.visitors.arrival.label}, out ${point.visitors.departure.label}`,
            trailing: [chip("In", point.residents.arrival), chip("Out", point.residents.departure)],
          }),
        )
      : [card.text("No control point matches.", true)],
    footer: "Chips show Hong Kong residents. Normal: residents usually wait under 15 min, visitors under 30 min.",
  };
}

function daily({ data = {} }: CardInput): Card {
  const points: DailyControlPoint[] = data.controlPoints ?? [];
  const sorted = [...points].sort((a, b) => (b.arrival?.total ?? 0) + (b.departure?.total ?? 0) - ((a.arrival?.total ?? 0) + (a.departure?.total ?? 0)));
  return {
    ...base,
    title: `Passenger traffic on ${data.date ?? "—"}`,
    subtitle: data.latestDate && data.latestDate !== data.date ? `Latest day published: ${data.latestDate}` : null,
    blocks: blocks(
      data.note && card.notice(data.note, "info"),
      data.total && card.stats([{ label: "Arrivals", value: count(data.total.arrival?.total) }, { label: "Departures", value: count(data.total.departure?.total) }]),
      sorted.slice(0, 10).map((point) =>
        card.row({ title: point.controlPoint, trailing: [{ text: `In ${count(point.arrival?.total)}`, tone: "accent" }, { text: `Out ${count(point.departure?.total)}` }] }),
      ),
    ),
  };
}

function annual({ data = {} }: CardInput): Card {
  const years: Row[] = data.years ?? [];
  return {
    ...base,
    title: "Annual cross-boundary traffic",
    subtitle: "Million trips",
    blocks: years.slice(-10).map((year) =>
      card.row({
        leading: { text: String(year.year) },
        title: `${year.passengerTrips} million passenger trips`,
        subtitle: `Air ${year.passengerTripsByAir} · Sea ${year.passengerTripsBySea} · Land ${year.passengerTripsByLand}`,
        trailing: [{ text: `${year.visitorTrips} visitors`, tone: "accent" }],
      }),
    ),
  };
}

function passengers(result: CardInput): Card {
  const rows: Row[] = Array.isArray(result.data) ? result.data : [];
  return {
    ...base,
    title: "Passengers cleared by Customs",
    subtitle: "Thousands per year",
    blocks: rows.slice(0, 10).map((row) => card.row({ leading: { text: String(row.year) }, title: row.controlPoint, trailing: [{ text: count(row.passengersThousands), tone: "accent" }] })),
    footer: truncation(result),
  };
}

function vehicles(result: CardInput): Card {
  const rows: VehicleQuarter[] = Array.isArray(result.data) ? result.data : [];
  return {
    ...base,
    title: `Vehicles at land crossings${rows[0]?.year ? `, ${rows[0].year}` : ""}`,
    subtitle: "Thousands per quarter",
    blocks: rows.slice(0, 10).map((row) =>
      card.row({
        leading: { text: `Q${row.quarter}` },
        title: row.controlPoint,
        subtitle: `Goods ${count(row.goodsVehicles)} · Passenger ${count(row.passengerVehicles)} · Private cars ${count(row.privateCars)}`,
        trailing: [{ text: count(row.total), tone: "accent" }],
      }),
    ),
    footer: truncation(result),
  };
}

const builders: Record<string, CardBuilder> = {
  border_waiting_times: waiting,
  border_daily_passengers: daily,
  border_annual_traffic: annual,
  border_passenger_throughput: passengers,
  border_vehicle_throughput: vehicles,
};

export const buildCard: CardBuilder = (result) => builders[result.tool]?.(result) ?? null;
