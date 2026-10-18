// Hospital Authority A&E MCP App: hospitals ranked by waiting time.
import { h, mount, ui, type Row, type View } from "../../apps/runtime";

/** "19 minutes", "1.5 hours", "less than 15 minutes", "over 8 hours", "19分鐘", "1.5小時" → minutes. */
export function toMinutes(text: unknown): number | null {
  if (!text) return null;
  const value = parseFloat(String(text).replace(/[^\d.]/g, " ").trim().split(/\s+/)[0]);
  if (!isFinite(value)) return null;
  return /hour|小時|小时/i.test(String(text)) ? value * 60 : value;
}

function colourFor(minutes: number | null) {
  if (minutes === null) return "var(--border)";
  if (minutes <= 60) return "#2e7d32";
  if (minutes <= 150) return "#f9a825";
  return "#c62828";
}

function bar(minutes: number | null, max: number) {
  const width = minutes === null ? 0 : Math.max(4, Math.min(100, (minutes / max) * 100));
  return h("div", { class: "bar" }, h("span", { style: { width: `${width}%`, background: colourFor(minutes) } }));
}

function waitingTimes(view: View) {
  const raw: Row = view.data;
  const hospitals = ((Array.isArray(raw) ? raw : raw?.waitTime) ?? []).map((hospital: Row) => ({
    hospital,
    standard: toMinutes(hospital.t45p50),
  }));
  hospitals.sort((a: { standard: number | null }, b: { standard: number | null }) => (a.standard ?? Infinity) - (b.standard ?? Infinity));
  const max = Math.max(60, ...hospitals.map((item: { standard: number | null }) => item.standard ?? 0));

  return [
    ui.header({
      badge: "A&E",
      title: view.input.hospital ? `A&E matching “${view.input.hospital}”` : "A&E waiting times",
      subtitle: "Shortest semi-urgent wait first",
      actions: [ui.refreshButton()],
    }),
    hospitals.length
      ? ui.list(
          hospitals.map(({ hospital, standard }: { hospital: Row; standard: number | null }) =>
            h(
              "div",
              { class: "row", style: { flexDirection: "column", alignItems: "stretch", gap: "6px" } },
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "baseline" } },
                h("span", { class: "row-title" }, hospital.hospName),
                h("span", { class: "eta eta-next", style: { background: colourFor(standard), color: "#ffffff" } }, hospital.t45p50 || "—"),
              ),
              bar(standard, max),
              h(
                "div",
                { class: "chips" },
                ui.chip(`Urgent ${hospital.t3p50 || "—"}${hospital.t3p95 ? ` (95%: ${hospital.t3p95})` : ""}`),
                hospital.t45p95 ? ui.chip(`Semi/non-urgent 95%: ${hospital.t45p95}`) : null,
                hospital.manageT1case === "Y" ? ui.chip("Handling a critical case", "danger") : null,
                hospital.manageT2case === "Y" ? ui.chip("Handling an emergency case", "warning") : null,
              ),
            ),
          ),
        )
      : ui.empty("No hospitals match."),
    ui.footer(view, "Median waits. Critical and emergency cases are seen first."),
  ];
}

mount({
  accent: "#00796b",
  render(view) {
    if (view.status === "loading") return [ui.header({ badge: "A&E", title: "A&E waiting times", subtitle: "Checking hospitals…" }), ui.skeleton(4)];
    return !view.tool || view.tool === "ha_aed_waiting_times" ? waitingTimes(view) : ui.generic(view.data);
  },
});
