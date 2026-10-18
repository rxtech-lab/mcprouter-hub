// Air Quality Health Index chat cards: the same views as app.ts, as still pictures.
import { blocks, card, fmt, type Card, type CardBuilder, type CardInput, type Chip, type Tone } from "../../apps/card";
import type { AqhiRange, ForecastPeriod, RiskLevel, RiskRange, StationHistory, StationReading } from "./handlers";

const ACCENT = "#00843d";
const base = { accent: ACCENT, badge: "AQHI" };

const TONES: Record<RiskLevel, Tone> = { low: "success", moderate: "warning", high: "danger", very_high: "danger", serious: "danger" };
const RISK_NAMES: Record<RiskLevel, string> = { low: "Low", moderate: "Moderate", high: "High", very_high: "Very high", serious: "Serious" };

const aqhiText = (aqhi: number | null, risk: RiskLevel | null) => (aqhi === null ? "—" : risk === "serious" && aqhi >= 10 ? "10+" : String(aqhi));

const riskChip = (label: string | null, levels: RiskLevel[]): Chip => {
  const worst = levels[levels.length - 1];
  return { text: label || "—", tone: worst ? TONES[worst] : "neutral" };
};

const updated = (value: unknown) => (value ? `Updated ${fmt.dateTime(value)}` : null);

function current({ data = {} }: CardInput): Card {
  const stations: StationReading[] = data.stations ?? [];
  const row = (station: StationReading) =>
    card.row({ leading: { text: aqhiText(station.aqhi, station.risk), tone: station.risk ? TONES[station.risk] : "neutral" }, title: station.station, trailing: [riskChip(station.riskLabel, station.risk ? [station.risk] : [])] });
  const general = stations.filter((station) => station.type === "general");
  const roadside = stations.filter((station) => station.type === "roadside");
  const both = general.length > 0 && roadside.length > 0;
  return {
    ...base,
    title: "Air Quality Health Index",
    subtitle: updated(data.updated),
    blocks: stations.length
      ? blocks(both && card.section("General stations"), general.map(row), both && card.section("Roadside stations"), roadside.map(row))
      : [card.text("No station matches.", true)],
    footer: "AQHI 1-3 low, 4-6 moderate, 7 high, 8-10 very high, 10+ serious health risk",
  };
}

function rangeText(range: AqhiRange) {
  const max = aqhiText(range.aqhiMax, range.riskLevels[range.riskLevels.length - 1] ?? null);
  return range.aqhiMin === range.aqhiMax ? max : `${range.aqhiMin}–${max}`;
}

const outlook = (label: string, range: RiskRange | null) => (range ? `${label}: ${range.risk}` : null);

function forecast({ data = {} }: CardInput): Card {
  const now: Record<"general" | "roadside", AqhiRange | null> = data.current ?? { general: null, roadside: null };
  const periods: ForecastPeriod[] = data.forecast ?? [];
  return {
    ...base,
    title: "AQHI now and forecast",
    subtitle: updated(data.updated),
    blocks: blocks(
      card.stats([now.general && { label: `General · ${now.general.risk}`, value: rangeText(now.general) }, now.roadside && { label: `Roadside · ${now.roadside.risk}`, value: rangeText(now.roadside) }]),
      periods.length > 0 && card.section("Forecast health risk"),
      periods.map((period) =>
        card.row({
          title: period.period,
          subtitle: [outlook("General", period.general), outlook("Roadside", period.roadside)].filter(Boolean).join(" · "),
          trailing: period.general ? [riskChip(period.general.risk, period.general.riskLevels)] : [],
        }),
      ),
    ),
  };
}

function past({ data = {} }: CardInput): Card {
  const station: StationHistory | undefined = data.stations?.[0];
  if (!station) return { ...base, title: "Past 24 hours", blocks: [card.text("No station matches.", true)] };
  const latest = station.readings[station.readings.length - 1];
  const highest = station.highest;
  return {
    ...base,
    title: station.station,
    subtitle: `${station.type === "roadside" ? "Roadside" : "General"} station · past 24 hours`,
    blocks: blocks(
      latest && card.hero(aqhiText(latest.aqhi, latest.risk), `AQHI at ${fmt.time(latest.time)}`, latest.risk ? `${RISK_NAMES[latest.risk]} health risk` : null, latest.risk ? TONES[latest.risk] : undefined),
      highest && card.stats([{ label: `Highest, ${fmt.time(highest.time)}`, value: aqhiText(highest.aqhi, highest.risk) }]),
      card.chips(station.readings.slice(-12).map((reading) => ({ text: `${fmt.time(reading.time)} ${aqhiText(reading.aqhi, reading.risk)}`, tone: reading.risk ? TONES[reading.risk] : "neutral" }))),
    ),
    footer: data.stations.length > 1 ? `Also matched: ${data.stations.slice(1).map((other: StationHistory) => other.station).join(", ")}` : null,
  };
}

const builders: Record<string, CardBuilder> = {
  aqhi_current: current,
  aqhi_forecast: forecast,
  aqhi_past_24h: past,
};

export const buildCard: CardBuilder = (result) => builders[result.tool]?.(result) ?? null;
