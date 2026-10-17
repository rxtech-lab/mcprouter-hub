import type { ToolHandler } from "@/lib/mcp/types";

/**
 * The 1823 feed is iCalendar converted to JSON, served with a UTF-8 BOM (the
 * shared fetcher strips it). These handlers flatten `vevent` into plain dates.
 */

type VEvent = { dtstart: [string, unknown?]; dtend?: [string, unknown?]; summary: string };
type Feed = { vcalendar: Array<{ vevent: VEvent[] }> };

export type Holiday = { date: string; name: string };

function isoDate(compact: string) {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

export function flattenHolidays(feed: Feed): Holiday[] {
  return (feed.vcalendar?.[0]?.vevent ?? [])
    .map((event) => ({ date: isoDate(String(event.dtstart[0])), name: event.summary }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function load(lang: unknown, fetchUpstream: Parameters<ToolHandler>[1]["fetchUpstream"]) {
  const language = lang === "tc" || lang === "sc" ? lang : "en";
  const feed = (await fetchUpstream(`https://www.1823.gov.hk/common/ical/${language}.json`, { format: "json" })) as Feed;
  return flattenHolidays(feed);
}

export const holidays: ToolHandler = async (input, context) => {
  const all = await load(input.lang, context.fetchUpstream);
  const year = input.year === undefined ? null : String(input.year);
  const list = year ? all.filter((holiday) => holiday.date.startsWith(year)) : all;
  return {
    holidays: list,
    coverage: all.length ? { from: all[0].date, to: all[all.length - 1].date } : null,
  };
};

export const isHoliday: ToolHandler = async (input, context) => {
  const all = await load(input.lang, context.fetchUpstream);
  const date = String(input.date);
  const match = all.find((holiday) => holiday.date === date);
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const covered = all.length > 0 && date >= all[0].date && date <= all[all.length - 1].date;
  return {
    date,
    isPublicHoliday: Boolean(match),
    holiday: match?.name ?? null,
    isSunday: weekday === 0,
    ...(covered ? {} : { note: "This date is outside the range the 1823 feed covers, so the answer may be incomplete." }),
  };
};
