// Tides, sun and moon MCP App: predicted high and low tides, observed sea levels, and rise and set times.
import { fmt, h, mount, ui, type Content, type Row, type View } from "../../apps/runtime";
import type { SunMoonDay, TideDay, TideObservation } from "./handlers";

const metres = (value: number | null | undefined) => (value === null || value === undefined ? "—" : `${value.toFixed(2)} m`);

const dayLabel = (date: string) => fmt.day(`${date}T12:00:00+08:00`);

function stat(label: string, value: Content) {
  return h("div", { class: "stat" }, h("div", { class: "stat-label" }, label), h("div", { class: "stat-value" }, value));
}

function tides(view: View) {
  const data: Row = view.data ?? {};
  const days: TideDay[] = data.days ?? [];
  const heights = days.flatMap((day) => day.tides.map((tide) => tide.heightM));
  const top = Math.max(0.1, ...heights);
  return [
    ui.header({ badge: "≈", title: `Tides at ${data.station?.name ?? "—"}`, subtitle: "Predicted, metres above Chart Datum" }),
    data.note ? ui.notice(data.note, "warning") : null,
    days.length
      ? days.map((day) =>
          ui.section(
            dayLabel(day.date),
            day.tides.length
              ? ui.list(
                  day.tides.map((tide) =>
                    ui.row({
                      leading: ui.chip(tide.type === "high" ? "High" : "Low", tide.type === "high" ? "info" : null),
                      title: tide.time,
                      subtitle: h("div", { class: "bar" }, h("span", { style: { width: `${(tide.heightM / top) * 100}%` } })),
                      trailing: metres(tide.heightM),
                    }),
                  ),
                )
              : ui.empty("No high or low tide this day."),
          ),
        )
      : ui.empty("No predictions for these dates."),
    h("footer", { class: "footer" }, "Astronomical predictions, Hong Kong time. Storm surges can raise the sea well above these."),
  ];
}

function observations(view: View) {
  const stations: TideObservation[] = Array.isArray(view.data) ? view.data : [];
  const latest = stations.map((station) => station.time).filter(Boolean).sort().at(-1);
  return [
    ui.header({ badge: "≈", title: "Sea levels now", subtitle: latest ? `Observed ${fmt.dateTime(latest)}` : null, actions: [ui.refreshButton()] }),
    stations.length
      ? ui.list(
          stations.map((station) =>
            ui.row({
              leading: station.code ? ui.badge(station.code) : null,
              title: station.name,
              subtitle: station.time && station.time !== latest ? fmt.dateTime(station.time) : null,
              trailing: station.heightM === null ? ui.chip("No reading") : h("span", { class: "eta" }, metres(station.heightM)),
            }),
          ),
        )
      : ui.empty("No station matches."),
    h("footer", { class: "footer" }, "Metres above Chart Datum."),
  ];
}

function sunMoon(view: View) {
  const data: Row = view.data ?? {};
  const days: SunMoonDay[] = data.days ?? [];
  const time = (value: string | null) => value ?? "—";
  if (days.length === 1) {
    const [day] = days;
    return [
      ui.header({ badge: "☀", title: "Sun and moon", subtitle: dayLabel(day.date) }),
      h("div", { class: "stats" }, stat("Sunrise", time(day.sunrise)), stat("Sunset", time(day.sunset)), stat("Solar noon", time(day.sunTransit))),
      h("div", { class: "stats" }, stat("Moonrise", time(day.moonrise)), stat("Moonset", time(day.moonset)), stat("Moon transit", time(day.moonTransit))),
      h("footer", { class: "footer" }, "Hong Kong time. A dash means the event doesn't happen that day."),
    ];
  }
  return [
    ui.header({ badge: "☀", title: "Sun and moon", subtitle: days.length ? `${dayLabel(days[0].date)} – ${dayLabel(days[days.length - 1].date)}` : null }),
    data.note ? ui.notice(data.note, "info") : null,
    days.length
      ? ui.table(
          days.map((day) => ({
            Date: dayLabel(day.date),
            Sunrise: time(day.sunrise),
            Sunset: time(day.sunset),
            Moonrise: time(day.moonrise),
            Moonset: time(day.moonset),
          })),
        )
      : ui.empty("No times for these dates."),
  ];
}

const views: Record<string, (view: View) => Content> = {
  hko_tide_times: tides,
  hko_tide_observations: observations,
  hko_sun_moon: sunMoon,
};

mount({
  accent: "#1565c0",
  render(view) {
    if (view.status === "loading") return [ui.header({ badge: "≈", title: "Tides, sun and moon", subtitle: "Checking the Observatory…" }), ui.skeleton(3)];
    const draw = view.tool ? views[view.tool] : undefined;
    return draw ? draw(view) : ui.generic(view.data);
  },
});
