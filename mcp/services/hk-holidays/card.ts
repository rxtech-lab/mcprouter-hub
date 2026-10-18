// Hong Kong public holiday chat cards: upcoming holidays and a yes/no answer for one date, as still pictures.
import { blocks, card, fmt, type Card, type CardBuilder, type CardInput } from "../../apps/card";
import type { Holiday } from "./handlers";

const ACCENT = "#c62828";
const noon = (date: string) => `${date}T12:00:00+08:00`;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong" }).format(new Date());
const daysFromToday = (date: string) => Math.round((Date.parse(noon(date)) - Date.parse(noon(today()))) / 86_400_000);

function holidays({ input, data = {} }: CardInput): Card {
  const list: Holiday[] = data.holidays ?? [];
  const now = today();
  const next = list.find((holiday) => holiday.date >= now);
  // A picture has no scrolling, so past holidays give way to the coming ones.
  const upcoming = list.filter((holiday) => holiday.date >= now);
  const shown = upcoming.length ? upcoming : list;
  return {
    accent: ACCENT,
    badge: "HK",
    title: input?.year ? `Public holidays in ${input.year}` : "Public holidays",
    subtitle: `${fmt.plural(list.length, "general holiday")}${shown.length < list.length ? `, ${shown.length} still to come` : ""}`,
    blocks: blocks(
      next && card.notice(next.date === now ? `Today is ${next.name}` : `Next: ${next.name}, ${fmt.day(noon(next.date))} (in ${daysFromToday(next.date)} days)`, "info"),
      shown.length
        ? shown.map((holiday) => {
            const days = daysFromToday(holiday.date);
            return card.row({
              leading: { text: fmt.day(noon(holiday.date), { weekday: undefined }), tone: holiday.date === next?.date ? "accent" : "neutral" },
              title: holiday.name,
              subtitle: fmt.day(noon(holiday.date), { weekday: "long", month: undefined, day: undefined }),
              trailing: [{ text: days < 0 ? "Past" : days === 0 ? "Today" : `in ${days} d` }],
              muted: days < 0,
            });
          })
        : card.text("No holidays in this range.", true),
    ),
    footer: data.coverage ? `Calendar covers ${data.coverage.from} to ${data.coverage.to}` : null,
  };
}

function isHoliday({ data }: CardInput): Card | null {
  if (!data?.date) return null;
  const yes = Boolean(data.isPublicHoliday);
  return {
    accent: ACCENT,
    badge: "HK",
    title: fmt.day(noon(data.date), { weekday: "long", year: "numeric", month: "long" }),
    blocks: blocks(
      card.hero(yes ? data.holiday : data.isSunday ? "Sunday" : "Not a public holiday", yes ? "Public holiday" : data.isSunday ? "Not a public holiday" : "Working day", null, yes ? "success" : "neutral"),
      data.note && card.notice(data.note, "warning"),
    ),
  };
}

const builders: Record<string, CardBuilder> = { hk_public_holidays: holidays, hk_is_public_holiday: isHoliday };

export const buildCard: CardBuilder = (result) => builders[result.tool]?.(result) ?? null;
