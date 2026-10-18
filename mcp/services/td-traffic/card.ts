// Transport Department traffic chat cards: the same views as app.ts, as still pictures.
import { card, fmt, truncation, type Card, type CardBuilder, type CardInput, type Tone } from "../../apps/card";
import type { Camera, Indicator, Journey, TrafficNews } from "./handlers";

const ACCENT = "#1a4fa0";
const base = { accent: ACCENT, badge: "TD" };

const STATUS_TONES: Record<string, Tone> = { new: "danger", updated: "warning", closed: "success" };
const STATUS_LABELS: Record<string, string> = { new: "New", updated: "Updated", closed: "Closed" };
const COLOUR_TONES: Record<string, Tone> = { green: "success", amber: "warning", red: "danger" };

function news(result: CardInput): Card {
  const items: TrafficNews[] = Array.isArray(result.data) ? result.data : [];
  return {
    ...base,
    title: "Special traffic news",
    subtitle: `${items.filter((item) => item.status !== "closed").length} in progress`,
    blocks: items.length
      ? items.slice(0, 8).map((item) =>
          card.row({
            title: [item.detail ?? item.heading, item.location].filter(Boolean).join(" · "),
            subtitle: item.content ?? null,
            trailing: [item.status && { text: STATUS_LABELS[item.status], tone: STATUS_TONES[item.status] }, item.announcedAt && { text: fmt.time(item.announcedAt) }].filter(
              (chip): chip is { text: string; tone?: Tone } => Boolean(chip),
            ),
            muted: item.status === "closed",
          }),
        )
      : [card.text("No special traffic news right now.", true)],
    footer: truncation(result),
  };
}

const journeyChip = (journey: Journey) => ({
  text: `${journey.destinationCode} ${journey.minutes !== null ? `${journey.minutes} min` : (journey.notice ?? "—")}`,
  tone: journey.colour ? COLOUR_TONES[journey.colour] : "neutral",
});

function journeys({ data = {} }: CardInput): Card {
  const indicators: Indicator[] = data.indicators ?? [];
  return {
    ...base,
    title: "Journey times",
    subtitle: data.capturedAt ? `Updated ${fmt.time(data.capturedAt)}` : null,
    blocks: indicators.length
      ? indicators.slice(0, 10).map((indicator) =>
          card.row({
            leading: { text: indicator.code },
            title: indicator.location,
            subtitle: indicator.journeys.map((journey) => journey.destination).join(" · "),
            trailing: indicator.journeys.slice(0, 4).map(journeyChip),
          }),
        )
      : [card.text("No journey time indicator matches.", true)],
  };
}

function cameras(result: CardInput): Card {
  const list: Camera[] = Array.isArray(result.data) ? result.data : [];
  return {
    ...base,
    title: "Traffic cameras",
    subtitle: `${result.meta.total ?? list.length} found`,
    blocks: list.length
      ? list.slice(0, 10).map((camera) => card.row({ leading: { text: camera.key }, title: camera.description ?? camera.key, subtitle: [camera.district, camera.region].filter(Boolean).join(" · ") }))
      : [card.text("No camera matches.", true)],
    footer: truncation(result),
  };
}

const builders: Record<string, CardBuilder> = {
  traffic_news: news,
  traffic_journey_times: journeys,
  traffic_cameras: cameras,
};

export const buildCard: CardBuilder = (result) => builders[result.tool]?.(result) ?? null;
