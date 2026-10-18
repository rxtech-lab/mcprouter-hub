// Regional weather chat cards: the same views as app.ts, as still pictures.
import { blocks, card, fmt, type Card, type CardBuilder, type CardInput, type Row, type Tone } from "../../apps/card";
import type { HeatStressStation, Lightning, RainfallStation, StationWeather } from "./handlers";

const ACCENT = "#1565c0";
const base = { accent: ACCENT, badge: "HKO" };

const value = (number: number | null | undefined, unit = "") => (number === null || number === undefined ? "—" : `${number}${unit}`);

const updated = (data: Row) => (data?.observedAt ? `Observed ${fmt.dateTime(data.observedAt)}` : null);

function rainfall({ data = {} }: CardInput): Card {
  const stations: RainfallStation[] = data.stations ?? [];
  const wet = stations.filter((item) => (item.rainfallMm ?? 0) > 0).sort((a, b) => (b.rainfallMm ?? 0) - (a.rainfallMm ?? 0));
  return {
    ...base,
    title: "Rainfall in the past hour",
    subtitle: updated(data),
    blocks: blocks(
      stations.length > 0 && !wet.length && card.notice("No rain recorded in the past hour.", "success"),
      (wet.length ? wet : stations).slice(0, 10).map((item) =>
        card.row({ leading: { text: item.id }, title: item.station, trailing: [{ text: item.rainfallMm === null ? "Unavailable" : `${item.rainfallMm} mm`, tone: (item.rainfallMm ?? 0) > 0 ? "info" : "neutral" }] }),
      ),
    ),
    footer: wet.length > 10 ? `Wettest 10 of ${wet.length} stations with rain` : null,
  };
}

const UV_TONES: Record<string, Tone> = { low: "success", moderate: "warning", high: "warning", very_high: "danger", extreme: "danger" };

function uv({ data = {} }: CardInput): Card {
  return {
    ...base,
    badge: "UV",
    title: "UV index",
    subtitle: updated(data),
    blocks: [card.hero(value(data.uvIndex), data.label, "15-minute mean at King's Park", UV_TONES[data.level])],
  };
}

function lightning({ data = {} }: CardInput): Card {
  const counts = data as Lightning;
  const strokes = (counts.total?.cloudToGround ?? 0) + (counts.total?.cloudToCloud ?? 0);
  return {
    ...base,
    badge: "⚡",
    title: "Lightning in the past hour",
    subtitle: counts.from ? `${fmt.dateTime(counts.from)} – ${fmt.time(counts.to)}` : null,
    blocks: blocks(
      strokes ? card.notice(`${strokes} lightning strokes over Hong Kong`, "warning") : card.notice("No lightning over Hong Kong.", "success"),
      card.stats([
        { label: "Cloud-to-ground", value: value(counts.total?.cloudToGround) },
        { label: "Cloud-to-cloud", value: value(counts.total?.cloudToCloud) },
      ]),
      (counts.cloudToGroundByRegion ?? []).map((item) => card.row({ title: item.region, trailing: [{ text: value(item.count), tone: item.count ? "warning" : "neutral" }] })),
    ),
  };
}

function regional({ data = {} }: CardInput): Card {
  const stations: StationWeather[] = data.stations ?? [];
  return {
    ...base,
    title: "Regional weather",
    subtitle: updated(data),
    blocks: stations.length
      ? stations.slice(0, 12).map((item) =>
          card.row({
            title: item.station,
            subtitle:
              [
                item.humidityPercent !== undefined && `Humidity ${item.humidityPercent}%`,
                item.pressureHpa !== undefined && `${item.pressureHpa} hPa`,
                item.windDirection && `Wind ${item.windDirection}${item.windSpeedKmh !== undefined ? ` ${item.windSpeedKmh} km/h` : ""}`,
              ]
                .filter(Boolean)
                .join(" · ") || null,
            trailing: item.temperatureC !== undefined ? [{ text: `${item.temperatureC}°C`, tone: "accent" }] : undefined,
          }),
        )
      : [card.text("No station matches.", true)],
    footer: stations.length > 12 ? `Showing 12 of ${stations.length} stations` : null,
  };
}

function heat({ data = {} }: CardInput): Card {
  const stations: HeatStressStation[] = [...(data.stations ?? [])].sort((a: HeatStressStation, b: HeatStressStation) => (b.heatIndex ?? 0) - (a.heatIndex ?? 0));
  return {
    ...base,
    title: "Heat stress",
    subtitle: updated(data),
    blocks: stations.length
      ? stations.map((item) => card.row({ title: item.station, trailing: [{ text: `HKHI ${value(item.heatIndex)}`, tone: "accent" }, { text: `WBGT ${value(item.wbgtC, "°C")}` }] }))
      : [card.text("No station matches.", true)],
    footer: "Heat Index: 10-minute mean. WBGT: 60-minute mean.",
  };
}

const builders: Record<string, CardBuilder> = {
  hko_rainfall_past_hour: rainfall,
  hko_uv_index: uv,
  hko_lightning: lightning,
  hko_regional_weather: regional,
  hko_heat_stress: heat,
};

export const buildCard: CardBuilder = (result) => builders[result.tool]?.(result) ?? null;
