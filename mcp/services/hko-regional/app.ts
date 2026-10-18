// Regional weather MCP App: station readings, rainfall, the UV index, lightning and heat stress.
import { fmt, h, mount, ui, type Content, type Row, type Tone, type View } from "../../apps/runtime";
import type { HeatStressStation, Lightning, RainfallStation, StationWeather } from "./handlers";

const value = (number: number | null | undefined, unit = "") => (number === null || number === undefined ? "—" : `${number}${unit}`);

const updated = (data: Row) => (data?.observedAt ? `Observed ${fmt.dateTime(data.observedAt)}` : null);

function stat(label: string, content: Content) {
  return h("div", { class: "stat" }, h("div", { class: "stat-label" }, label), h("div", { class: "stat-value" }, content));
}

function rainfall(view: View) {
  const data: Row = view.data ?? {};
  const stations: RainfallStation[] = data.stations ?? [];
  const wet = [...stations].filter((item) => (item.rainfallMm ?? 0) > 0).sort((a, b) => (b.rainfallMm ?? 0) - (a.rainfallMm ?? 0));
  const dry = stations.filter((item) => !wet.includes(item));
  return [
    ui.header({ badge: "HKO", title: "Rainfall in the past hour", subtitle: updated(data), actions: [ui.refreshButton()] }),
    stations.length && !wet.length ? ui.notice("No rain recorded in the past hour.", "success") : null,
    stations.length
      ? ui.more(
          [...wet, ...dry].map((item) =>
            ui.row({
              leading: ui.badge(item.id),
              title: item.station,
              trailing: item.rainfallMm === null ? h("span", { class: "muted" }, "Unavailable") : ui.chip(`${item.rainfallMm} mm`, item.rainfallMm > 0 ? "info" : null),
            }),
          ),
          12,
          "stations",
        )
      : ui.empty("No station matches."),
  ];
}

const UV_TONES: Record<string, Tone> = { low: "success", moderate: "warning", high: "warning", very_high: "danger", extreme: "danger" };

function uv(view: View) {
  const data: Row = view.data ?? {};
  return [
    ui.header({ badge: "UV", title: "UV index", subtitle: updated(data) }),
    h(
      "div",
      { class: "hero" },
      h("div", null, h("div", { class: "hero-value" }, value(data.uvIndex)), data.label ? ui.chip(data.label, UV_TONES[data.level]) : null),
    ),
    h("footer", { class: "footer" }, "15-minute mean at King's Park, measured from 7 a.m. to 6 p.m."),
  ];
}

function lightning(view: View) {
  const data: Lightning = view.data ?? {};
  const strokes = (data.total?.cloudToGround ?? 0) + (data.total?.cloudToCloud ?? 0);
  return [
    ui.header({ badge: "⚡", title: "Lightning in the past hour", subtitle: data.from ? `${fmt.dateTime(data.from)} – ${fmt.time(data.to)}` : null }),
    strokes ? ui.notice(`${strokes} lightning strokes over Hong Kong`, "warning") : ui.notice("No lightning over Hong Kong.", "success"),
    h("div", { class: "stats" }, stat("Cloud-to-ground", value(data.total?.cloudToGround)), stat("Cloud-to-cloud", value(data.total?.cloudToCloud))),
    ui.list((data.cloudToGroundByRegion ?? []).map((item) => ui.row({ title: item.region, trailing: ui.chip(value(item.count), item.count ? "warning" : null) }))),
  ];
}

function regional(view: View) {
  const data: Row = view.data ?? {};
  const stations: StationWeather[] = data.stations ?? [];
  return [
    ui.header({ badge: "HKO", title: "Regional weather", subtitle: updated(data), actions: [ui.refreshButton()] }),
    stations.length
      ? ui.table(
          stations.map((item) => ({
            Station: item.station,
            "Temp °C": value(item.temperatureC),
            "Humidity %": value(item.humidityPercent),
            "Pressure hPa": value(item.pressureHpa),
            Wind: item.windDirection ? `${item.windDirection}${item.windSpeedKmh !== undefined ? ` ${item.windSpeedKmh} km/h` : ""}` : "—",
            "Gust km/h": value(item.gustKmh),
          })),
        )
      : ui.empty("No station matches."),
  ];
}

function heat(view: View) {
  const data: Row = view.data ?? {};
  const stations: HeatStressStation[] = [...(data.stations ?? [])].sort((a: HeatStressStation, b: HeatStressStation) => (b.heatIndex ?? 0) - (a.heatIndex ?? 0));
  return [
    ui.header({ badge: "HKO", title: "Heat stress", subtitle: updated(data), actions: [ui.refreshButton()] }),
    stations.length
      ? ui.table(stations.map((item) => ({ Station: item.station, "Heat Index": value(item.heatIndex), "WBGT °C": value(item.wbgtC) })))
      : ui.empty("No station matches."),
    h("footer", { class: "footer" }, "Hong Kong Heat Index: 10-minute mean. Wet Bulb Globe Temperature: 60-minute mean."),
  ];
}

const views: Record<string, (view: View) => Content> = {
  hko_rainfall_past_hour: rainfall,
  hko_uv_index: uv,
  hko_lightning: lightning,
  hko_regional_weather: regional,
  hko_heat_stress: heat,
};

mount({
  accent: "#1565c0",
  render(view) {
    if (view.status === "loading") return [ui.header({ badge: "HKO", title: "Regional weather", subtitle: "Reading the weather stations…" }), ui.skeleton(3)];
    const draw = view.tool ? views[view.tool] : undefined;
    return draw ? draw(view) : ui.generic(view.data);
  },
});
