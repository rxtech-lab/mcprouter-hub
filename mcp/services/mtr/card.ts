// MTR chat cards: next-train boards and Light Rail platforms, as still pictures.
import { blocks, card, fmt, langOf, type Card, type CardBuilder, type CardInput, type Row } from "../../apps/card";
import { LINES, station } from "./stations";

function minutes(train: Row) {
  const value = Number(train.ttnt);
  if (!isFinite(value)) return fmt.time(train.time);
  return value <= 0 ? "Arriving" : `${value} min`;
}

function nextTrain({ input, data: body = {} }: CardInput): Card {
  const code = String(input?.line ?? "").toUpperCase();
  const sta = String(input?.sta ?? "").toUpperCase();
  const line = LINES[code] ?? { name: code, colour: "#5a6a75" };
  const board: Row = body.data?.[`${code}-${sta}`] ?? Object.values(body.data ?? {})[0] ?? null;
  const direction = (trains: Row[] | undefined) =>
    trains?.length
      ? [
          card.section(`To ${station(trains[0].dest)}`),
          ...trains.map((train, index) =>
            card.row({
              leading: { text: `Platform ${train.plat}` },
              title: station(train.dest),
              subtitle: `${fmt.time(train.time)}${train.route === "RAC" ? " · via Racecourse" : ""}`,
              trailing: [{ text: minutes(train), tone: index === 0 ? "accent" : "neutral" }],
            }),
          ),
        ]
      : null;
  return {
    accent: line.colour,
    badge: code || "MTR",
    title: station(sta),
    subtitle: line.name,
    blocks: blocks(
      body.isdelay === "Y" && card.notice("Trains on this line are delayed.", "warning"),
      body.status === 0 && card.notice(body.message || "Train data is not available.", "warning"),
      board ? blocks(direction(board.UP), direction(board.DOWN)) : card.text("No train times for this station right now.", true),
    ),
    footer: body.curr_time ? `Updated ${fmt.time(body.curr_time)}` : null,
  };
}

function lightRail({ input, data: body = {} }: CardInput): Card {
  const platforms: Row[] = body.platform_list ?? [];
  const chinese = langOf(input) !== "en";
  return {
    accent: "#d3a809",
    onAccent: "#1d1b16",
    badge: "LR",
    title: `Light Rail stop ${input?.stationId ?? ""}`.trim(),
    subtitle: fmt.plural(platforms.length, "platform"),
    blocks: platforms.length
      ? platforms.flatMap((platform) => [
          card.section(`Platform ${platform.platform_id}`),
          ...(platform.route_list ?? []).map((train: Row, index: number) =>
            card.row({
              leading: { text: String(train.route_no), tone: "accent" },
              title: chinese ? train.dest_ch : train.dest_en,
              subtitle: train.train_length > 1 ? `${train.train_length} cars` : "1 car",
              trailing: [{ text: chinese ? train.time_ch : train.time_en, tone: index === 0 ? "accent" : "neutral" }],
            }),
          ),
        ])
      : [card.text("No trains are due at this stop right now.", true)],
    footer: body.system_time ? `Updated ${fmt.time(body.system_time)}` : null,
  };
}

const builders: Record<string, CardBuilder> = { mtr_next_train: nextTrain, mtr_light_rail_schedule: lightRail };

export const buildCard: CardBuilder = (result) => builders[result.tool]?.(result) ?? null;
