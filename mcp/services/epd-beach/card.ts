// Beach water quality chat cards: the same view as app.ts, as a still picture.
import { blocks, card, fmt, type Card, type CardBuilder, type CardInput, type Tone } from "../../apps/card";
import type { Beach } from "./handlers";

const ACCENT = "#00838f";
const base = { accent: ACCENT, badge: "≈" };

const TONES: Record<number, Tone> = { 1: "success", 2: "info", 3: "warning", 4: "danger" };

function beaches({ data = {} }: CardInput): Card {
  const list: Beach[] = data.beaches ?? [];
  const poor = list.filter((beach) => (beach.grade ?? 0) >= 3);
  // The worst grades first, so a long list still shows the beaches to avoid.
  const sorted = [...list].sort((a, b) => (b.grade ?? 0) - (a.grade ?? 0));
  return {
    ...base,
    title: "Beach water quality",
    subtitle: `${list.length} ${list.length === 1 ? "beach" : "beaches"}${data.updated ? ` · graded ${fmt.dateTime(data.updated)}` : ""}`,
    blocks: list.length
      ? blocks(
          poor.length > 0 && card.notice(`Below the swimming standard: ${poor.map((beach) => beach.name).join(", ")}`, "warning"),
          sorted.slice(0, 12).map((beach) =>
            card.row({
              leading: { text: beach.code },
              title: beach.name,
              subtitle: beach.district,
              trailing: [beach.grade ? { text: `${beach.rating} · ${beach.grade}`, tone: TONES[beach.grade] } : { text: "Not graded" }],
            }),
          ),
        )
      : [card.text("No beach matches.", true)],
    footer: list.length > 12 ? `Showing 12 of ${list.length}, worst first. Grades 1 and 2 meet the swimming standard.` : "Grades 1 (Good) and 2 (Fair) meet the swimming standard.",
  };
}

const builders: Record<string, CardBuilder> = {
  beach_water_quality: beaches,
};

export const buildCard: CardBuilder = (result) => builders[result.tool]?.(result) ?? null;
