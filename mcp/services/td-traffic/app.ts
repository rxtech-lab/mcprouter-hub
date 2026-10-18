// Transport Department traffic MCP App: special traffic news, journey time indicators and camera snapshots.
import { app, fmt, h, mount, ui, type Content, type Tone, type View } from "../../apps/runtime";
import type { Camera, Indicator, Journey, TrafficNews } from "./handlers";

const STATUS_TONES: Record<string, Tone> = { new: "danger", updated: "warning", closed: "success" };
const STATUS_LABELS: Record<string, string> = { new: "New", updated: "Updated", closed: "Closed" };
const COLOUR_TONES: Record<string, Tone> = { green: "success", amber: "warning", red: "danger" };

/** "Kowloon bound", or "往九龍方向" as the Chinese messages say it. */
function bound(direction: string | undefined, lang: unknown) {
  if (!direction) return null;
  return lang === "tc" || lang === "sc" ? `往${direction}方向` : `${direction} bound`;
}

function news(view: View) {
  const items: TrafficNews[] = Array.isArray(view.data) ? view.data : [];
  const open = items.filter((item) => item.status !== "closed").length;
  return [
    ui.header({ badge: "TD", title: "Special traffic news", subtitle: items.length ? `${open} in progress · ${items.length} announced` : null, actions: [ui.refreshButton()] }),
    items.length
      ? ui.more(
          items.map((item) =>
            h(
              "div",
              { class: "row", style: { flexDirection: "column", alignItems: "stretch", gap: "6px" } },
              h(
                "div",
                { style: { display: "flex", gap: "8px", alignItems: "flex-start", justifyContent: "space-between" } },
                h(
                  "span",
                  { class: "row-text" },
                  h("span", { class: "row-title" }, [item.detail ?? item.heading, item.location].filter(Boolean).join(" · ")),
                  h("span", { class: "row-subtitle" }, [bound(item.direction, view.input.lang), item.district, fmt.dateTime(item.announcedAt)].filter(Boolean).join(" · ")),
                ),
                item.status ? ui.chip(STATUS_LABELS[item.status], STATUS_TONES[item.status]) : null,
              ),
              item.content ? h("p", { class: "prose" }, item.content) : null,
              item.latitude !== undefined ? h("div", { class: "actions" }, ui.mapButton(item.latitude, item.longitude)) : null,
            ),
          ),
          6,
          "news items",
        )
      : ui.empty("No special traffic news right now."),
    ui.footer(view),
  ];
}

function journeyChip(journey: Journey) {
  const value = journey.minutes !== null ? `${journey.minutes} min` : (journey.notice ?? "—");
  return ui.chip(`${journey.destination}: ${value}`, journey.colour ? COLOUR_TONES[journey.colour] : null);
}

function journeys(view: View) {
  const indicators: Indicator[] = view.data?.indicators ?? [];
  return [
    ui.header({ badge: "TD", title: "Journey times", subtitle: view.data?.capturedAt ? `Updated ${fmt.time(view.data.capturedAt)}` : null, actions: [ui.refreshButton()] }),
    indicators.length
      ? ui.more(
          indicators.map((indicator) =>
            ui.row({
              leading: ui.badge(indicator.code),
              title: indicator.location,
              subtitle: h("span", { class: "chips" }, indicator.journeys.map(journeyChip)),
            }),
          ),
          10,
          "indicators",
        )
      : ui.empty("No journey time indicator matches."),
    h("footer", { class: "footer" }, "Average driving time from each roadside sign, in the colour the sign shows."),
  ];
}

function snapshot(camera: Camera): Content {
  const image = h("img", {
    src: camera.imageUrl,
    alt: camera.description ?? camera.key,
    loading: "lazy",
    style: { width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: "8px", background: "var(--surface)", display: "block" },
  });
  return h(
    "figure",
    { style: { margin: "0", display: "flex", flexDirection: "column", gap: "4px", cursor: "pointer" }, onclick: () => void app.openLink(camera.imageUrl), title: camera.imageUrl },
    image,
    h("figcaption", { class: "row-text" }, h("span", { class: "row-title" }, camera.description ?? camera.key), h("span", { class: "row-subtitle" }, [camera.key, camera.district].filter(Boolean).join(" · "))),
  );
}

function cameras(view: View) {
  const list: Camera[] = Array.isArray(view.data) ? view.data : [];
  return [
    ui.header({ badge: "TD", title: view.input.search ? `Cameras at “${view.input.search}”` : "Traffic cameras", subtitle: `${view.meta.total ?? list.length} found` }),
    list.length
      ? h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" } }, list.slice(0, 12).map(snapshot))
      : ui.empty("No camera matches."),
    list.length > 12 ? ui.more(list.slice(12).map((camera) => ui.row({ leading: ui.badge(camera.key), title: camera.description ?? camera.key, subtitle: camera.district, onclick: () => void app.openLink(camera.imageUrl) })), 0, "more cameras") : null,
    ui.footer(view),
  ];
}

const views: Record<string, (view: View) => Content> = {
  traffic_news: news,
  traffic_journey_times: journeys,
  traffic_cameras: cameras,
};

mount({
  accent: "#1a4fa0",
  render(view) {
    if (view.status === "loading") return [ui.header({ badge: "TD", title: "Traffic", subtitle: "Checking the roads…" }), ui.skeleton(3)];
    const draw = view.tool ? views[view.tool] : undefined;
    return draw ? draw(view) : ui.generic(view.data);
  },
});
