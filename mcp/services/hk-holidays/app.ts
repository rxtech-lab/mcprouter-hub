// Hong Kong public holidays MCP App: a holiday calendar and a yes/no answer for one date.
import { fmt, h, mount, ui, type View } from "../../apps/runtime";
import type { Holiday } from "./handlers";

const noon = (date: string) => `${date}T12:00:00+08:00`;

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong" }).format(new Date());
}

function daysFromToday(date: string) {
  return Math.round((Date.parse(noon(date)) - Date.parse(noon(today()))) / 86_400_000);
}

function dateTile(date: string, highlight: boolean) {
  const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "Asia/Hong_Kong" }).format(fmt.date(noon(date)) ?? new Date());
  return h(
    "span",
    {
      class: "header-badge",
      style: { flexDirection: "column", width: "48px", height: "48px", lineHeight: "1.05", background: highlight ? "var(--accent)" : "var(--surface-2)", color: highlight ? "var(--on-accent)" : "var(--text)" },
    },
    h("span", { style: { fontSize: "11px", fontWeight: "500", textTransform: "uppercase" } }, month),
    h("span", { style: { fontSize: "18px" } }, String(Number(date.slice(8, 10)))),
  );
}

function holidays(view: View) {
  const data: { holidays?: Holiday[]; coverage?: { from: string; to: string } | null } = view.data ?? {};
  const list = data.holidays ?? [];
  const now = today();
  const next = list.find((holiday) => holiday.date >= now);
  return [
    ui.header({ badge: "HK", title: view.input.year ? `Public holidays in ${view.input.year}` : "Public holidays", subtitle: `${list.length} general holidays` }),
    next
      ? ui.notice(next.date === now ? `Today is ${next.name}` : `Next: ${next.name}, ${fmt.day(noon(next.date))} (in ${daysFromToday(next.date)} days)`, "info")
      : null,
    list.length
      ? ui.list(
          list.map((holiday) => {
            const past = holiday.date < now;
            const days = daysFromToday(holiday.date);
            const row = ui.row({
              leading: dateTile(holiday.date, holiday.date === next?.date),
              title: holiday.name,
              subtitle: fmt.day(noon(holiday.date), { weekday: "long", month: undefined, day: undefined }),
              trailing: past ? h("span", { class: "muted" }, "Past") : h("span", { class: "eta" }, days === 0 ? "Today" : `in ${days} d`),
            });
            if (past) row.style.opacity = "0.6";
            return row;
          }),
        )
      : ui.empty("No holidays in this range."),
    data.coverage ? ui.footer(view, `Calendar covers ${data.coverage.from} to ${data.coverage.to}`) : null,
  ];
}

function isHoliday(view: View) {
  const data: { date: string; isPublicHoliday: boolean; holiday: string | null; isSunday: boolean; note?: string } = view.data;
  const yes = data.isPublicHoliday;
  return [
    h(
      "div",
      { class: "hero" },
      dateTile(data.date, yes),
      h(
        "div",
        null,
        h("div", { class: "title", style: { fontSize: "18px" } }, yes ? data.holiday : data.isSunday ? "Sunday, not a public holiday" : "Not a public holiday"),
        h("div", { class: "muted" }, fmt.day(noon(data.date), { weekday: "long", year: "numeric", month: "long" })),
      ),
      h("span", { style: { marginLeft: "auto" } }, ui.chip(yes ? "Public holiday" : "Working day", yes ? "success" : null)),
    ),
    data.note ? ui.notice(data.note, "warning") : null,
  ];
}

mount({
  accent: "#c62828",
  render(view) {
    if (view.status === "loading") return [ui.header({ badge: "HK", title: "Public holidays", subtitle: "Checking the 1823 calendar…" }), ui.skeleton(3)];
    if (view.tool === "hk_public_holidays") return holidays(view);
    if (view.tool === "hk_is_public_holiday") return isHoliday(view);
    return ui.generic(view.data);
  },
});
