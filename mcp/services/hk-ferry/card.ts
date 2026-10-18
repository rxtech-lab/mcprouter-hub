// Ferry chat cards: the same views as app.ts, as still pictures.
import { blocks, card, fmt, type Card, type CardBuilder, type CardInput, type Chip, type Row } from "../../apps/card";
import type { FerryRoute, Sailing } from "./handlers";

const ACCENT = "#0277bd";
const base = { accent: ACCENT, badge: "⛴" };

const money = (value: number | null | undefined) => (value === null || value === undefined ? "—" : value === 0 ? "Free" : `$${value.toFixed(1)}`);

function routes({ data = {} }: CardInput): Card {
  const list: FerryRoute[] = data.routes ?? [];
  return {
    ...base,
    title: "Ferry routes",
    subtitle: fmt.plural(list.length, "route direction"),
    blocks: list.length
      ? list.slice(0, 12).map((route) =>
          card.row({
            leading: { text: route.route },
            title: `${route.from} → ${route.to}`,
            subtitle: [route.operatorName, route.fromPier, route.service].filter(Boolean).join(" · "),
            trailing: route.direction ? [{ text: route.direction }] : [],
          }),
        )
      : [card.text("No route matches.", true)],
    footer: list.length > 12 ? `Showing 12 of ${list.length}` : null,
  };
}

function sailingChip(sailing: Sailing): Chip {
  if (sailing.status === "scheduled") return { text: `Departs ${fmt.time(sailing.departure)}` };
  const eta = fmt.eta(sailing.eta);
  return { text: eta || `Due ${fmt.time(sailing.eta)}`, tone: "accent" };
}

function arrivals({ data = {} }: CardInput): Card {
  const sailings: Sailing[] = data.sailings ?? [];
  return {
    ...base,
    title: data.name ?? "Next sailings",
    subtitle: [data.operator, data.route ? `route ${data.route}` : null].filter(Boolean).join(" · "),
    blocks: sailings.length
      ? sailings.map((sailing) =>
          card.row({
            leading: { text: fmt.time(sailing.departure) },
            title: `${sailing.from} → ${sailing.to}`,
            subtitle: [sailing.fromPier, sailing.eta ? `Arrives ${fmt.time(sailing.eta)}` : null, sailing.remark].filter(Boolean).join(" · ") || null,
            trailing: [...(sailing.fast ? [{ text: "Fast", tone: "info" } as Chip] : []), sailingChip(sailing)],
          }),
        )
      : [card.text("No sailing is under way on this route right now.", true)],
    footer: data.updatedAt ? `Updated ${fmt.time(data.updatedAt)}` : null,
  };
}

const timeChips = (sailings: Array<{ time: string; marks?: string[] }>): Chip[] => sailings.map((sailing) => ({ text: `${sailing.marks?.join("") ?? ""}${sailing.time}` }));

function timetable({ data }: CardInput): Card | null {
  if (!data) return null;
  const remarks: Array<{ mark?: string; text: string }> = data.remarks ?? [];
  return {
    ...base,
    title: `${data.from} → ${data.to}`,
    subtitle: `HKKF route ${data.route} timetable`,
    blocks: blocks(
      card.section("Monday to Saturday"),
      card.chips(timeChips(data.mondayToSaturday ?? [])),
      card.section("Sundays and public holidays"),
      card.chips(timeChips(data.sundayAndHolidays ?? [])),
      remarks.slice(0, 4).map((remark) => card.text(`${remark.mark ? `${remark.mark} ` : ""}${remark.text}`, true)),
    ),
  };
}

function fares({ input, data }: CardInput): Card {
  const rows: Row[] = Array.isArray(data) ? data : [];
  return {
    ...base,
    title: `HKKF route ${input?.route ?? ""} fares`,
    subtitle: "HK$, Monday to Saturday / Sundays and public holidays",
    blocks: rows.map((row) =>
      card.row({
        title: row.ticket,
        trailing: row.price !== undefined ? [{ text: money(row.price), tone: "accent" }] : [{ text: money(row.mondayToSaturday), tone: "accent" }, { text: money(row.sundayAndHolidays) }],
      }),
    ),
  };
}

const builders: Record<string, CardBuilder> = {
  ferry_routes: routes,
  ferry_arrivals: arrivals,
  hkkf_timetable: timetable,
  hkkf_fares: fares,
};

export const buildCard: CardBuilder = (result) => builders[result.tool]?.(result) ?? null;
