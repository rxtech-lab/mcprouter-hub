// Hong Kong Observatory MCP App: current conditions, forecasts, warnings, earthquakes and the lunar calendar.
import { fmt, h, mount, ui, type Content, type Row, type Tone, type View } from "../../apps/runtime";

// Icons come from the Observatory; the resource CSP allows this one origin (see service.yaml).
function weatherIcon(code: unknown, size: number) {
  if (!code) return null;
  const image = h("img", { src: `https://www.hko.gov.hk/images/HKOWxIconOutline/pic${Number(code)}.png`, alt: "", width: size, height: size, loading: "lazy" });
  image.addEventListener("error", () => image.remove());
  return image;
}

function stat(label: string, value: Content) {
  return h("div", { class: "stat" }, h("div", { class: "stat-label" }, label), h("div", { class: "stat-value" }, value));
}

function asList(value: unknown): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).filter(Boolean).map(String);
}

function current(view: View) {
  const data: Row = view.data ?? {};
  const temperatures: Row[] = data.temperature?.data ?? [];
  const main = temperatures.find((item) => /observatory|天文台/i.test(item.place)) ?? temperatures[0];
  const humidity = data.humidity?.data?.[0];
  const uv = data.uvindex?.data?.[0];
  const rain: Row[] = (data.rainfall?.data ?? []).filter((item: Row) => Number(item.max) > 0);
  return [
    h(
      "div",
      { class: "hero" },
      weatherIcon(asList(data.icon)[0], 64),
      h("div", null, h("div", { class: "hero-value" }, main ? `${main.value}°` : "—"), h("div", { class: "muted" }, main?.place ?? "")),
    ),
    asList(data.warningMessage).map((text) => ui.notice(text, "warning")),
    asList(data.tcmessage).map((text) => ui.notice(text, "danger")),
    h(
      "div",
      { class: "stats" },
      humidity ? stat("Humidity", `${humidity.value}%`) : null,
      uv ? stat("UV index", `${uv.value} ${uv.desc ?? ""}`) : null,
      stat("Rain (past hour)", rain.length ? `${Math.max(...rain.map((item) => Number(item.max)))} mm max` : "None"),
    ),
    asList(data.specialWxTips).map((text) => ui.notice(text, "info")),
    temperatures.length > 1
      ? h(
          "details",
          { class: "more" },
          h("summary", null, `Temperature at ${temperatures.length} stations`),
          ui.list(temperatures.map((item) => ui.row({ title: item.place, trailing: h("span", { class: "eta" }, `${item.value}°${item.unit ?? "C"}`) }))),
        )
      : null,
    rain.length ? ui.section("Rain by district", ui.list(rain.map((item) => ui.row({ title: item.place, trailing: `${item.max} ${item.unit}` })))) : null,
    ui.footer(view, data.updateTime ? `Updated ${fmt.time(data.updateTime)}` : null),
  ];
}

function local(view: View) {
  const data: Row = view.data ?? {};
  return [
    ui.header({ badge: "HKO", title: data.forecastPeriod || "Local forecast", subtitle: data.updateTime ? `Issued ${fmt.dateTime(data.updateTime)}` : null }),
    data.tcInfo ? ui.notice(data.tcInfo, "danger") : null,
    data.fireDangerWarning ? ui.notice(data.fireDangerWarning, "warning") : null,
    h("div", { class: "kv", style: { display: "block" } }, h("p", { class: "prose" }, data.forecastDesc), data.outlook ? h("p", { class: "prose muted" }, `Outlook: ${data.outlook}`) : null),
    data.generalSituation ? h("p", { class: "muted prose" }, data.generalSituation) : null,
  ];
}

const RAIN_TONES: Record<string, Tone> = { High: "danger", "Medium High": "warning", Medium: "warning", "Medium Low": "info", Low: "info" };

function nineDay(view: View) {
  const data: Row = view.data ?? {};
  const days: Row[] = data.weatherForecast ?? [];
  const low = Math.min(...days.map((day) => day.forecastMintemp.value));
  const high = Math.max(...days.map((day) => day.forecastMaxtemp.value));
  const span = Math.max(1, high - low);
  return [
    ui.header({ badge: "9", title: "9-day forecast", subtitle: data.updateTime ? `Updated ${fmt.dateTime(data.updateTime)}` : null }),
    h(
      "div",
      { class: "strip" },
      days.map((day, index) => {
        const date = String(day.forecastDate);
        const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T12:00:00+08:00`;
        const min = day.forecastMintemp.value;
        const max = day.forecastMaxtemp.value;
        return h(
          "div",
          { class: "stat", style: { minWidth: "112px", animationDelay: `${index * 40}ms` }, title: day.forecastWeather },
          h("div", { class: "stat-label" }, fmt.day(iso)),
          weatherIcon(day.ForecastIcon, 44),
          h("div", { class: "stat-value" }, `${max}°`, h("span", { class: "muted", style: { fontSize: "14px", fontWeight: "400" } }, ` ${min}°`)),
          h("div", { class: "bar", style: { margin: "6px 0" } }, h("span", { style: { marginLeft: `${((min - low) / span) * 100}%`, width: `${((max - min) / span) * 100}%` } })),
          ui.chip(`Rain: ${day.PSR}`, RAIN_TONES[day.PSR]),
        );
      }),
    ),
    data.generalSituation ? h("p", { class: "muted prose" }, data.generalSituation) : null,
  ];
}

const WARNING_TONES: Record<string, Tone> = { Red: "danger", Black: "danger", Amber: "warning", Yellow: "warning" };

function warnings(view: View) {
  const data: Row = view.data ?? {};
  const items: Row[] = Object.values(data).filter((item: Row) => item?.name);
  return [
    ui.header({ badge: "⚠", title: "Weather warnings", subtitle: items.length ? `${items.length} in force` : null }),
    items.length
      ? ui.list(
          items.map((item) =>
            ui.row({
              leading: ui.chip(item.type || item.code, WARNING_TONES[item.type] ?? "info"),
              title: item.name,
              subtitle: item.issueTime ? `Issued ${fmt.dateTime(item.issueTime)}` : null,
              trailing: item.actionCode && item.actionCode !== "ISSUE" ? ui.chip(item.actionCode) : null,
            }),
          ),
        )
      : ui.notice("No weather warnings are in force.", "success"),
  ];
}

function warningDetails(view: View) {
  const details: Row[] = view.data?.details ?? [];
  return [
    ui.header({ badge: "⚠", title: "Warning details" }),
    details.length
      ? details.map((item) =>
          h("div", { class: "kv", style: { display: "block" } }, asList(item.contents).map((text) => h("p", { class: "prose" }, text)), h("p", { class: "footer" }, `Updated ${fmt.dateTime(item.updateTime)}`)),
        )
      : ui.notice("No weather warnings are in force.", "success"),
  ];
}

function tips(view: View) {
  const items: Row[] = view.data?.swt ?? [];
  return [
    ui.header({ badge: "HKO", title: "Special weather tips" }),
    items.length ? items.map((item) => ui.notice(item.desc ?? String(item), "info")) : ui.empty("No special weather tips right now."),
  ];
}

function earthquake(view: View) {
  const data: Row = view.data ?? {};
  if (data.mag === undefined) return [ui.header({ badge: "HKO", title: "Earthquake report" }), ui.generic(data)];
  const tone = data.mag >= 6 ? "danger" : data.mag >= 4.5 ? "warning" : "info";
  return [
    h(
      "div",
      { class: "hero" },
      h("div", { class: "header-badge", style: { width: "64px", height: "64px", borderRadius: "32px", fontSize: "22px", background: `var(--${tone}-bg)`, color: `var(--${tone}-text)` } }, String(data.mag)),
      h("div", null, h("div", { class: "title" }, `Magnitude ${data.mag} ${data.region ?? ""}`), h("div", { class: "muted" }, `${fmt.dateTime(data.ptime)} (Hong Kong time)`)),
    ),
    h("div", { class: "actions" }, ui.mapButton(data.lat, data.lon, `${data.lat}, ${data.lon}`)),
  ];
}

function lunar(view: View) {
  const data: Row = view.data ?? {};
  return h(
    "div",
    { class: "hero" },
    h("div", { class: "header-badge", style: { width: "56px", height: "56px", fontSize: "24px" } }, "農"),
    h(
      "div",
      null,
      h("div", { class: "title", style: { fontSize: "22px" } }, data.LunarDate || "—"),
      h("div", { class: "muted" }, data.LunarYear ?? ""),
      h("div", { class: "footer" }, view.input.date ? fmt.day(`${view.input.date}T12:00:00+08:00`, { year: "numeric" }) : ""),
    ),
  );
}

const views: Record<string, (view: View) => Content> = {
  hko_current_weather: current,
  hko_local_forecast: local,
  hko_nine_day_forecast: nineDay,
  hko_warning_summary: warnings,
  hko_warning_details: warningDetails,
  hko_special_weather_tips: tips,
  hko_earthquake: earthquake,
  hko_lunar_date: lunar,
};

mount({
  accent: "#1565c0",
  render(view) {
    if (view.status === "loading") return [ui.header({ badge: "HKO", title: "Hong Kong Observatory", subtitle: "Checking the weather…" }), ui.skeleton(3)];
    const draw = view.tool ? views[view.tool] : undefined;
    return draw ? draw(view) : ui.generic(view.data);
  },
});
