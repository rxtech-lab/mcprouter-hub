// Tides, sun and moon chat cards: the same views as app.ts, as still pictures.
import { blocks, card, fmt, truncation, type Card, type CardBuilder, type CardInput, type Row } from "../../apps/card";
import type { SunMoonDay, TideDay, TideObservation } from "./handlers";

const ACCENT = "#1565c0";
const base = { accent: ACCENT, badge: "≈" };

const metres = (value: number | null | undefined) => (value === null || value === undefined ? "—" : `${value.toFixed(2)} m`);

const dayLabel = (date: string) => fmt.day(`${date}T12:00:00+08:00`);

function tides({ data = {} }: CardInput): Card | null {
  const days: TideDay[] = data.days ?? [];
  if (!data.station) return null;
  return {
    ...base,
    title: `Tides at ${data.station.name}`,
    subtitle: "Predicted, metres above Chart Datum",
    blocks: blocks(
      data.note && card.notice(data.note, "warning"),
      days.slice(0, 7).flatMap((day) =>
        blocks(
          days.length > 1 && card.section(dayLabel(day.date)),
          day.tides.map((tide) =>
            card.row({ leading: { text: tide.type === "high" ? "High" : "Low", tone: tide.type === "high" ? "info" : "neutral" }, title: tide.time, trailing: [{ text: metres(tide.heightM), tone: "accent" }] }),
          ),
        ),
      ),
    ),
    footer: days.length === 1 ? `${dayLabel(days[0].date)} · Hong Kong time` : "Hong Kong time",
  };
}

function observations(result: CardInput): Card {
  const stations: TideObservation[] = Array.isArray(result.data) ? result.data : [];
  const latest = stations.map((station) => station.time).filter(Boolean).sort().at(-1);
  return {
    ...base,
    title: "Sea levels now",
    subtitle: latest ? `Observed ${fmt.dateTime(latest)}` : null,
    blocks: stations.length
      ? stations.map((station) =>
          card.row({
            leading: station.code ? { text: station.code } : undefined,
            title: station.name,
            trailing: [station.heightM === null ? { text: "No reading", tone: "neutral" } : { text: metres(station.heightM), tone: "accent" }],
          }),
        )
      : [card.text("No station matches.", true)],
    footer: truncation(result, "Metres above Chart Datum"),
  };
}

function sunMoon({ data = {} }: CardInput): Card {
  const days: SunMoonDay[] = data.days ?? [];
  const time = (value: string | null) => value ?? "—";
  if (days.length === 1) {
    const [day] = days;
    return {
      ...base,
      badge: "☀",
      title: "Sun and moon",
      subtitle: dayLabel(day.date),
      blocks: [
        card.stats([{ label: "Sunrise", value: time(day.sunrise) }, { label: "Sunset", value: time(day.sunset) }, { label: "Solar noon", value: time(day.sunTransit) }]),
        card.stats([{ label: "Moonrise", value: time(day.moonrise) }, { label: "Moonset", value: time(day.moonset) }, { label: "Moon transit", value: time(day.moonTransit) }]),
      ],
      footer: "Hong Kong time",
    };
  }
  return {
    ...base,
    badge: "☀",
    title: "Sun and moon",
    subtitle: days.length ? `${dayLabel(days[0].date)} – ${dayLabel(days[days.length - 1].date)}` : null,
    blocks: blocks(
      data.note && card.notice(data.note, "info"),
      days.slice(0, 10).map((day: Row) =>
        card.row({
          leading: { text: dayLabel(day.date) },
          title: `Sun ${time(day.sunrise)} – ${time(day.sunset)}`,
          subtitle: `Moonrise ${time(day.moonrise)} · Moonset ${time(day.moonset)}`,
        }),
      ),
    ),
    footer: days.length > 10 ? `Showing 10 of ${days.length} days · Hong Kong time` : "Hong Kong time",
  };
}

const builders: Record<string, CardBuilder> = {
  hko_tide_times: tides,
  hko_tide_observations: observations,
  hko_sun_moon: sunMoon,
};

export const buildCard: CardBuilder = (result) => builders[result.tool]?.(result) ?? null;
