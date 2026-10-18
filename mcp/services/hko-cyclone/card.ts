// Tropical cyclone chat cards: the same views as app.ts, as still pictures.
import { blocks, card, fmt, type Card, type CardBuilder, type CardInput, type Chip, type Tone } from "../../apps/card";
import type { CycloneSummary, CycloneTrack, TrackPoint } from "./handlers";

const ACCENT = "#1565c0";
const base = { accent: ACCENT, badge: "🌀" };

const TONES: Record<string, Tone> = { tropical_storm: "info", severe_tropical_storm: "warning", typhoon: "danger", severe_typhoon: "danger", super_typhoon: "danger" };

function intensity(point: TrackPoint | null): Chip[] {
  if (!point?.intensity) return [];
  const chips: Chip[] = [{ text: point.intensity, tone: (point.category && TONES[point.category]) || "neutral" }];
  if (point.maximumWindKmh) chips.push({ text: `${point.maximumWindKmh} km/h` });
  return chips;
}

const where = (point: { distanceKm?: number; bearing?: string } | null) => (point?.distanceKm === undefined ? null : `${point.distanceKm.toLocaleString("en-HK")} km ${point.bearing} of Hong Kong`);

const title = (cyclone: { name: string; chineseName: string | null }) => (cyclone.chineseName && cyclone.chineseName !== cyclone.name ? `${cyclone.name} ${cyclone.chineseName}` : cyclone.name);

function cyclones({ data = {} }: CardInput): Card {
  const list: CycloneSummary[] = data.cyclones ?? [];
  return {
    ...base,
    title: "Tropical cyclones",
    subtitle: list.length ? `${list.length} tracked by the Hong Kong Observatory` : "Hong Kong Observatory",
    blocks: list.length
      ? list.map((cyclone) =>
          card.row({
            leading: { text: String(cyclone.id) },
            title: title(cyclone),
            subtitle: [where(cyclone.current), cyclone.current?.time && `at ${fmt.dateTime(cyclone.current.time)}`].filter(Boolean).join(" "),
            trailing: intensity(cyclone.current),
          }),
        )
      : [card.text(data.note ?? "No tropical cyclone is being tracked.", true)],
  };
}

function track({ data }: CardInput): Card | null {
  const cyclone = data as CycloneTrack | undefined;
  if (!cyclone?.name) return null;
  const current = cyclone.current;
  return {
    ...base,
    title: title(cyclone),
    subtitle: cyclone.bulletinTime ? `Updated ${fmt.dateTime(cyclone.bulletinTime)}` : null,
    blocks: blocks(
      current &&
        card.stats([
          { label: "Intensity", value: current.intensity ?? "—" },
          { label: "Max wind", value: current.maximumWindKmh ? `${current.maximumWindKmh} km/h` : "—" },
          { label: "From Hong Kong", value: current.distanceKm !== undefined ? `${current.distanceKm.toLocaleString("en-HK")} km ${current.bearing}` : "—" },
        ]),
      cyclone.forecast.length ? card.section("Forecast") : card.text("No forecast track: the Observatory has stopped forecasting this cyclone.", true),
      cyclone.forecast.slice(0, 8).map((point) => card.row({ title: fmt.dateTime(point.time), subtitle: where(point), trailing: intensity(point) })),
    ),
  };
}

const builders: Record<string, CardBuilder> = {
  hko_tropical_cyclones: cyclones,
  hko_cyclone_track: track,
};

export const buildCard: CardBuilder = (result) => builders[result.tool]?.(result) ?? null;
