// Census and Statistics Department Hong Kong Shipping Statistics MCP App.
import { mount, ui, type Row, type Tone, type View } from "../../apps/runtime";

const TITLES: Record<string, string> = {
  shipping_port_cargo_throughput: "Port Cargo Throughput (410-55110)",
  shipping_seaborne_cargo_throughput: "Seaborne Cargo Throughput (410-55111)",
  shipping_seaborne_cargo_monthly: "Seaborne Cargo by Month (410-55111A)",
  shipping_river_cargo_throughput: "River Cargo Throughput (410-55112)",
  shipping_river_cargo_monthly: "River Cargo by Month (410-55112A)",
  shipping_port_cargo_seasonally_adjusted: "Seasonally Adjusted Port Cargo Change (410-55113)",
  shipping_port_cargo_gba_city: "Port Cargo by GBA City (410-55114)",
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

function tableView(view: View) {
  const rows: Row[] = Array.isArray(view.data) ? view.data : [];
  const title = (view.tool && TITLES[view.tool]) || "Hong Kong Shipping Statistics";
  const subtitle = [
    view.input?.period ? `Period ${view.input.period}` : "Latest periods",
    view.input?.freq ? `Freq ${view.input.freq}` : null,
    view.input?.city ? `City: ${view.input.city}` : null,
    `${rows.length} rows`,
  ]
    .filter(Boolean)
    .join(" · ");

  return [
    ui.header({
      badge: "SHIP",
      title,
      subtitle,
      actions: [ui.refreshButton()],
    }),
    rows.length
      ? ui.more(
          rows.map((row) => {
            const label = row.COUNTRYDesc
              ? String(row.COUNTRYDesc)
              : [row.DIRECTIONDesc || row.DIRECTION, row.SHIPMENT_TYPEDesc || row.SHIPMENT_TYPE].filter(Boolean).join(" · ");
            const sub = [row.TRANSDesc, row.svDesc, row.sd_value ? `Note: ${row.sd_value}` : null].filter(Boolean).join(" · ");
            return ui.row({
              leading: ui.badge(`${row.freq ? `${row.freq} ` : ""}${row.period ?? ""}`.trim()),
              title: label || "Total",
              subtitle: sub,
              trailing: ui.chip(formatFigure(row), figureTone(row)),
            });
          }),
          10,
          "records",
        )
      : ui.empty("No matching shipping statistics found."),
    ui.footer(view),
  ];
}

mount({
  accent: "#0f766e",
  render(view) {
    if (view.status === "loading") {
      return [ui.header({ badge: "SHIP", title: "Shipping Statistics", subtitle: "Loading C&SD table…" }), ui.skeleton(4)];
    }
    if (view.tool && view.tool in TITLES) return tableView(view);
    return ui.generic(view.data);
  },
});
