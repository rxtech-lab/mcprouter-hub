// Tropical cyclone MCP App: the cyclones the Observatory is tracking, and one cyclone's track drawn against Hong Kong.
import { app, fmt, h, mount, ui, type Content, type Tone, type View } from "../../apps/runtime";
import type { CycloneSummary, CycloneTrack, TrackPoint } from "./handlers";

const HONG_KONG = { latitude: 22.3, longitude: 114.17 };

const TONES: Record<string, Tone | null> = {
  tropical_storm: "info",
  severe_tropical_storm: "warning",
  typhoon: "danger",
  severe_typhoon: "danger",
  super_typhoon: "danger",
};

function intensityChip(point: TrackPoint | null) {
  if (!point?.intensity) return null;
  return ui.chip(point.maximumWindKmh ? `${point.intensity} · ${point.maximumWindKmh} km/h` : point.intensity, point.category ? TONES[point.category] : null);
}

const where = (point: { distanceKm?: number; bearing?: string } | null) => (point?.distanceKm === undefined ? "" : `${point.distanceKm.toLocaleString("en-HK")} km ${point.bearing} of Hong Kong`);

const SVG = "http://www.w3.org/2000/svg";

function svg(tag: string, attributes: Record<string, string | number>, ...children: Node[]) {
  const element = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  element.append(...children);
  return element;
}

/** The track on a plain latitude/longitude grid: past positions solid, forecast dashed, Hong Kong as a reference dot. */
function trackPlot(track: CycloneTrack) {
  const points = [...track.past, ...(track.current ? [track.current] : []), ...track.forecast];
  if (!points.length) return null;
  const all = [...points, HONG_KONG];
  const pad = 1.5;
  const west = Math.min(...all.map((point) => point.longitude)) - pad;
  const east = Math.max(...all.map((point) => point.longitude)) + pad;
  const south = Math.min(...all.map((point) => point.latitude)) - pad;
  const north = Math.max(...all.map((point) => point.latitude)) + pad;
  // Shrink longitude by the cosine of the middle latitude so the shape isn't stretched.
  const squeeze = Math.cos((((north + south) / 2) * Math.PI) / 180);
  const width = 320;
  const height = Math.max(160, Math.min(400, (width * (north - south)) / ((east - west) * squeeze)));
  const x = (longitude: number) => ((longitude - west) / (east - west)) * width;
  const y = (latitude: number) => ((north - latitude) / (north - south)) * height;
  const line = (list: Array<{ latitude: number; longitude: number }>) => list.map((point) => `${x(point.longitude).toFixed(1)},${y(point.latitude).toFixed(1)}`).join(" ");
  const pastLine = [...track.past, ...(track.current ? [track.current] : [])];
  const forecastLine = track.current ? [track.current, ...track.forecast] : track.forecast;
  const grid: Node[] = [];
  for (let lat = Math.ceil(south / 5) * 5; lat <= north; lat += 5) {
    grid.push(svg("line", { x1: 0, x2: width, y1: y(lat), y2: y(lat), stroke: "currentColor", "stroke-opacity": 0.12 }));
    grid.push(svg("text", { x: 4, y: y(lat) - 3, "font-size": 9, fill: "currentColor", "fill-opacity": 0.5 }, document.createTextNode(`${lat}°N`)));
  }
  for (let lon = Math.ceil(west / 5) * 5; lon <= east; lon += 5) {
    grid.push(svg("line", { y1: 0, y2: height, x1: x(lon), x2: x(lon), stroke: "currentColor", "stroke-opacity": 0.12 }));
  }
  return h(
    "figure",
    { class: "section", style: { margin: "0" } },
    svg(
      "svg",
      { viewBox: `0 0 ${width} ${height.toFixed(0)}`, width: "100%", role: "img", "aria-label": `Track of ${track.name}` },
      ...grid,
      svg("polyline", { points: line(pastLine), fill: "none", stroke: "var(--accent)", "stroke-width": 2, "stroke-linejoin": "round" }),
      svg("polyline", { points: line(forecastLine), fill: "none", stroke: "var(--accent)", "stroke-width": 2, "stroke-dasharray": "4 3" }),
      ...track.forecast.map((point) => svg("circle", { cx: x(point.longitude), cy: y(point.latitude), r: 3, fill: "var(--surface)", stroke: "var(--accent)", "stroke-width": 1.5 })),
      ...(track.current ? [svg("circle", { cx: x(track.current.longitude), cy: y(track.current.latitude), r: 5, fill: "var(--accent)" })] : []),
      svg("circle", { cx: x(HONG_KONG.longitude), cy: y(HONG_KONG.latitude), r: 4, fill: "currentColor" }),
      svg("text", { x: x(HONG_KONG.longitude) + 6, y: y(HONG_KONG.latitude) + 3, "font-size": 10, fill: "currentColor" }, document.createTextNode("Hong Kong")),
    ),
    h("figcaption", { class: "footer" }, "Solid: past track · dashed: forecast"),
  );
}

function cyclones(view: View) {
  const list: CycloneSummary[] = view.data?.cyclones ?? [];
  return [
    ui.header({ badge: "🌀", title: "Tropical cyclones", subtitle: list.length ? `${list.length} tracked by the Hong Kong Observatory` : "Hong Kong Observatory", actions: [ui.refreshButton()] }),
    list.length
      ? ui.list(
          list.map((cyclone) =>
            ui.row({
              leading: ui.badge(String(cyclone.id)),
              title: cyclone.chineseName && cyclone.chineseName !== cyclone.name ? `${cyclone.name} ${cyclone.chineseName}` : cyclone.name,
              subtitle: h(
                "span",
                { class: "chips" },
                intensityChip(cyclone.current),
                h("span", { class: "muted" }, where(cyclone.current)),
                cyclone.closestApproach && cyclone.closestApproach.distanceKm < (cyclone.current?.distanceKm ?? Infinity)
                  ? h("span", { class: "muted" }, `closest ${cyclone.closestApproach.distanceKm.toLocaleString("en-HK")} km, ${fmt.dateTime(cyclone.closestApproach.time)}`)
                  : null,
              ),
              onclick: () => void app.sendMessage(`Show the track of tropical cyclone ${cyclone.name} (id ${cyclone.id}).`),
              hint: "Show the track",
            }),
          ),
        )
      : ui.empty(view.data?.note ?? "No tropical cyclone is being tracked."),
  ];
}

function track(view: View) {
  const data = view.data as CycloneTrack | undefined;
  if (!data) return ui.empty("No track.");
  const current = data.current;
  return [
    ui.header({ badge: "🌀", title: data.chineseName && data.chineseName !== data.name ? `${data.name} ${data.chineseName}` : data.name, subtitle: data.bulletinTime ? `Updated ${fmt.dateTime(data.bulletinTime)}` : null, actions: [ui.refreshButton()] }),
    current
      ? h(
          "div",
          { class: "stats" },
          h("div", { class: "stat" }, h("div", { class: "stat-label" }, "Intensity"), h("div", { class: "stat-value" }, current.intensity ?? "—")),
          h("div", { class: "stat" }, h("div", { class: "stat-label" }, "Max wind"), h("div", { class: "stat-value" }, current.maximumWindKmh ? `${current.maximumWindKmh} km/h` : "—")),
          h("div", { class: "stat" }, h("div", { class: "stat-label" }, "From Hong Kong"), h("div", { class: "stat-value" }, current.distanceKm !== undefined ? `${current.distanceKm.toLocaleString("en-HK")} km ${current.bearing}` : "—")),
        )
      : null,
    trackPlot(data),
    data.forecast.length
      ? ui.section(
          "Forecast",
          ui.list(data.forecast.map((point) => ui.row({ title: fmt.dateTime(point.time), subtitle: where(point), trailing: intensityChip(point) }))),
        )
      : ui.notice("No forecast track: the Observatory has stopped forecasting this cyclone.", "info"),
  ];
}

const views: Record<string, (view: View) => Content> = {
  hko_tropical_cyclones: cyclones,
  hko_cyclone_track: track,
};

mount({
  accent: "#1565c0",
  render(view) {
    if (view.status === "loading") return [ui.header({ badge: "🌀", title: "Tropical cyclones", subtitle: "Checking the Observatory…" }), ui.skeleton(3)];
    const draw = view.tool ? views[view.tool] : undefined;
    return draw ? draw(view) : ui.generic(view.data);
  },
});
