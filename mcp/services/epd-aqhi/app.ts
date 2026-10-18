// Air Quality Health Index MCP App: the AQHI at each station, the range and forecast, and a station's past 24 hours.
import { fmt, h, mount, ui, type Content, type Row, type Tone, type View } from "../../apps/runtime";
import type { AqhiRange, ForecastPeriod, Hourly, RiskLevel, RiskRange, StationHistory, StationReading } from "./handlers";

const ACCENT = "#00843d";

// The EPD's colour for each health risk band.
const COLOURS: Record<RiskLevel, string> = { low: "#3ca241", moderate: "#f39c12", high: "#e53935", very_high: "#8d3c1e", serious: "#212121" };
const TONES: Record<RiskLevel, Tone> = { low: "success", moderate: "warning", high: "danger", very_high: "danger", serious: "danger" };
const RISK_NAMES: Record<RiskLevel, string> = { low: "Low", moderate: "Moderate", high: "High", very_high: "Very high", serious: "Serious" };

const aqhiText = (aqhi: number | null, risk: RiskLevel | null) => (aqhi === null ? "—" : risk === "serious" && aqhi >= 10 ? "10+" : String(aqhi));

function aqhiBadge(aqhi: number | null, risk: RiskLevel | null) {
  return ui.badge(aqhiText(aqhi, risk), risk ? { background: COLOURS[risk], color: "#ffffff", minWidth: "32px", justifyContent: "center" } : undefined);
}

function riskChip(label: string | null, levels: RiskLevel[]) {
  const worst = levels[levels.length - 1];
  return ui.chip(label || "—", worst ? TONES[worst] : null);
}

function current(view: View) {
  const data: Row = view.data ?? {};
  const stations: StationReading[] = data.stations ?? [];
  const high = stations.filter((station) => station.risk && station.risk !== "low" && station.risk !== "moderate");
  const group = (type: string, title: string) => {
    const shown = stations.filter((station) => station.type === type);
    if (!shown.length) return null;
    return ui.section(
      title,
      ui.list(shown.map((station) => ui.row({ leading: aqhiBadge(station.aqhi, station.risk), title: station.station, trailing: riskChip(station.riskLabel, station.risk ? [station.risk] : []) }))),
    );
  };
  return [
    ui.header({ badge: "AQHI", title: "Air Quality Health Index", subtitle: data.updated ? `Updated ${fmt.dateTime(data.updated)}` : null, actions: [ui.refreshButton()] }),
    high.length ? ui.notice(`High health risk at ${high.map((station) => station.station).join(", ")}. Reduce outdoor physical exertion.`, "danger") : null,
    stations.length ? [group("general", "General stations"), group("roadside", "Roadside stations")] : ui.empty("No station matches."),
    ui.footer(view, "AQHI 1-3 low, 4-6 moderate, 7 high, 8-10 very high, 10+ serious health risk"),
  ];
}

function rangeText(range: AqhiRange | null) {
  if (!range) return "—";
  return range.aqhiMin === range.aqhiMax ? aqhiText(range.aqhiMax, range.riskLevels.at(-1) ?? null) : `${range.aqhiMin}–${aqhiText(range.aqhiMax, range.riskLevels.at(-1) ?? null)}`;
}

function stat(label: string, range: AqhiRange | null) {
  return h(
    "div",
    { class: "stat" },
    h("div", { class: "stat-label" }, label),
    h("div", { class: "stat-value" }, rangeText(range)),
    range ? riskChip(range.risk, range.riskLevels) : null,
  );
}

function outlook(label: string, range: RiskRange | null) {
  return range ? h("span", { class: "chips" }, h("span", { class: "muted" }, label), riskChip(range.risk, range.riskLevels)) : null;
}

function forecast(view: View) {
  const data: Row = view.data ?? {};
  const periods: ForecastPeriod[] = data.forecast ?? [];
  return [
    ui.header({ badge: "AQHI", title: "AQHI now and forecast", subtitle: data.updated ? `Updated ${fmt.dateTime(data.updated)}` : null, actions: [ui.refreshButton()] }),
    h("div", { class: "stats" }, stat("General stations", data.current?.general ?? null), stat("Roadside stations", data.current?.roadside ?? null)),
    periods.length
      ? ui.section("Forecast health risk", ui.list(periods.map((period) => ui.row({ title: period.period, subtitle: h("span", { class: "chips" }, outlook("General", period.general), outlook("Roadside", period.roadside)) }))))
      : null,
  ];
}

function bars(readings: Hourly[]) {
  return h(
    "div",
    { style: { display: "flex", alignItems: "flex-end", gap: "2px", height: "72px", padding: "8px 12px", borderRadius: "var(--radius)", background: "var(--surface)" } },
    readings.map((reading) =>
      h("span", {
        title: `${fmt.time(reading.time)} · AQHI ${aqhiText(reading.aqhi, reading.risk)}`,
        style: {
          flex: "1",
          height: `${Math.max(4, Math.min(11, reading.aqhi ?? 0) * 9)}%`,
          borderRadius: "2px",
          background: reading.risk ? COLOURS[reading.risk] : "var(--surface-2)",
        },
      }),
    ),
  );
}

function past(view: View) {
  const stations: StationHistory[] = view.data?.stations ?? [];
  if (!stations.length) return [ui.header({ badge: "AQHI", title: "Past 24 hours" }), ui.empty("No station matches.")];
  return stations.map((station) => {
    const latest = station.readings.at(-1);
    return [
      ui.header({ badge: "AQHI", title: station.station, subtitle: `${station.type === "roadside" ? "Roadside" : "General"} station · past 24 hours` }),
      h(
        "div",
        { class: "stats" },
        h("div", { class: "stat" }, h("div", { class: "stat-label" }, latest ? `Latest, ${fmt.time(latest.time)}` : "Latest"), h("div", { class: "stat-value" }, aqhiText(latest?.aqhi ?? null, latest?.risk ?? null))),
        station.highest
          ? h(
              "div",
              { class: "stat" },
              h("div", { class: "stat-label" }, `Highest, ${fmt.time(station.highest.time)}`),
              h("div", { class: "stat-value" }, aqhiText(station.highest.aqhi, station.highest.risk)),
              station.highest.risk ? ui.chip(RISK_NAMES[station.highest.risk], TONES[station.highest.risk]) : null,
            )
          : null,
      ),
      bars(station.readings),
      h("footer", { class: "footer" }, [fmt.time(station.readings[0]?.time), fmt.time(latest?.time)].filter(Boolean).join(" → ")),
    ];
  });
}

const views: Record<string, (view: View) => Content> = {
  aqhi_current: current,
  aqhi_forecast: forecast,
  aqhi_past_24h: past,
};

mount({
  accent: ACCENT,
  render(view) {
    if (view.status === "loading") return [ui.header({ badge: "AQHI", title: "Air Quality Health Index", subtitle: "Reading the monitoring stations…" }), ui.skeleton(3)];
    const draw = view.tool ? views[view.tool] : undefined;
    return draw ? draw(view) : ui.generic(view.data);
  },
});
