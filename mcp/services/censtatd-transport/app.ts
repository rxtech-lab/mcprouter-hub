// Census and Statistics Department Hong Kong Transport & Postal Statistics MCP App.
import { mount, ui, type Row, type Tone, type View } from "../../apps/runtime";

const TITLES: Record<string, string> = {
  air_cargo_movements: "Air Cargo Movements (410-92011)",
  postal_services_statistics: "Postal Services Statistics (635-92076)",
  air_transport_capacity: "Air Transport Service Capacity (635-93002)",
  seafarers_statistics: "Seafarers Statistics (635-93003)",
  airport_arrival_transit_passengers: "Airport Arrival Transit Passengers (650-93021)",
};

function figureTone(row: Row): Tone {
  const unit = String(row.svDesc ?? "");
  if (unit.includes("%") && typeof row.figure === "number") {
    if (row.figure > 0) return "success";
    if (row.figure < 0) return "danger";
  }
  return "accent";
}

function formatFigure(row: Row): string {
  if (row.figure === null || row.figure === undefined || row.figure === "") return String(row.sd_value || "N.A.");
  const unit = String(row.svDesc ?? "");
  if (unit.includes("%")) return `${row.figure > 0 ? `+${row.figure}` : row.figure}%`;
  return `${Number(row.figure).toLocaleString()} ${unit}`.trim();
}

function rowTitle(row: Row): string {
  if (row.REGIONDesc || row.DIRECTIONDesc) {
    return [row.REGIONDesc || row.REGION, row.DIRECTIONDesc || row.DIRECTION].filter(Boolean).join(" · ");
  }
  if (row.PMDesc) {
    return [row.indicatorDesc || row.sv, row.PMDesc].filter(Boolean).join(" · ");
  }
  return String(row.indicatorDesc || row.sv || "Total");
}

function tableView(view: View) {
  const rows: Row[] = Array.isArray(view.data) ? view.data : [];
  const title = (view.tool && TITLES[view.tool]) || "Hong Kong Transport Statistics";
  const subtitle = [
    view.input?.period ? `Period ${view.input.period}` : "Latest periods",
    view.input?.freq ? `Freq ${view.input.freq}` : null,
    view.input?.region ? `Region: ${view.input.region}` : null,
    view.input?.indicator ? `${view.input.indicator}` : null,
    `${rows.length} rows`,
  ]
    .filter(Boolean)
    .join(" · ");

  return [
    ui.header({
      badge: "C&SD",
      title,
      subtitle,
      actions: [ui.refreshButton()],
    }),
    rows.length
      ? ui.more(
          rows.map((row) => {
            const sub = [row.svDesc, row.sd_value ? `Note: ${row.sd_value}` : null].filter(Boolean).join(" · ");
            return ui.row({
              leading: ui.badge(`${row.freq ? `${row.freq} ` : ""}${row.period ?? ""}`.trim()),
              title: rowTitle(row),
              subtitle: sub,
              trailing: ui.chip(formatFigure(row), figureTone(row)),
            });
          }),
          10,
          "records",
        )
      : ui.empty("No matching transport statistics found."),
    ui.footer(view),
  ];
}

mount({
  accent: "#1d4ed8",
  render(view) {
    if (view.status === "loading") {
      return [ui.header({ badge: "C&SD", title: "Transport Statistics", subtitle: "Loading C&SD table…" }), ui.skeleton(4)];
    }
    if (view.tool && view.tool in TITLES) return tableView(view);
    return ui.generic(view.data);
  },
});
