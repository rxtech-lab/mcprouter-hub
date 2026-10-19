// Licensed Taxi Fleets (Amigo & Big Boss Taxi) MCP App.
import { fmt, h, mount, ui, type Row, type Tone, type View } from "../../apps/runtime";

function statusTone(status: string): Tone {
  if (status === "V") return "success";
  if (status === "O") return "warning";
  return "danger";
}

function fleetView(view: View, fleetName: string, badge: string) {
  const taxis: Row[] = Array.isArray(view.data) ? view.data : [];
  const subtitleParts = [
    `${taxis.length} vehicles`,
    view.input?.status ? `Status: ${view.input.status}` : null,
    view.input?.taxiType ? `Type: ${view.input.taxiType}` : null,
  ].filter(Boolean);

  return [
    ui.header({
      badge,
      title: `${fleetName} Fleet`,
      subtitle: subtitleParts.join(" · "),
      actions: [ui.refreshButton()],
    }),
    taxis.length
      ? ui.more(
          taxis.map((taxi) => {
            const details = [
              taxi.taxi_type_label || taxi.taxi_type,
              taxi.passenger_cap ? `${taxi.passenger_cap} seats` : null,
              typeof taxi.distance_km === "number" ? `${taxi.distance_km} km away` : null,
              taxi.time_stamp ? `updated ${fmt.ago(taxi.time_stamp)}` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return ui.row({
              leading: ui.badge(String(taxi.taxi_type || "T")),
              title: String(taxi.veh_id || "Taxi"),
              subtitle: details,
              trailing: h(
                "span",
                { class: "chips" },
                ui.chip(String(taxi.status_label || taxi.op_status || "Unknown"), statusTone(String(taxi.op_status))),
                ui.mapButton(taxi.lat, taxi.long, "Map"),
              ),
            });
          }),
          8,
          "taxis",
        )
      : ui.empty("No matching fleet taxis found."),
    ui.footer(view),
  ];
}

mount({
  accent: "#d97706",
  render(view) {
    if (view.status === "loading") {
      return [ui.header({ badge: "TAXI", title: "Licensed Taxi Fleet", subtitle: "Checking fleet vehicles…" }), ui.skeleton(3)];
    }
    if (view.tool === "amigo_taxi_fleet") return fleetView(view, "Amigo", "AMG");
    if (view.tool === "big_boss_taxi_fleet") return fleetView(view, "Big Boss Taxi", "BBT");
    return ui.generic(view.data);
  },
});
