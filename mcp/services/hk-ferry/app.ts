// Ferries MCP App: routes, next sailings, and HKKF timetables and fares.
import { app, fmt, h, mount, ui, type Content, type Row, type View } from "../../apps/runtime";
import type { FerryRoute, Sailing } from "./handlers";

const BADGE = "⛴";

const money = (value: number | null | undefined) => (value === null || value === undefined ? "—" : value === 0 ? "Free" : `$${value.toFixed(1)}`);

function routes(view: View) {
  const list: FerryRoute[] = view.data?.routes ?? [];
  const operators = [...new Set(list.map((route) => route.operatorName))];
  return [
    ui.header({ badge: BADGE, title: "Ferry routes", subtitle: `${list.length} route directions` }),
    list.length
      ? operators.map((operator) =>
          ui.section(
            operator,
            ui.more(
              list
                .filter((route) => route.operatorName === operator)
                .map((route) =>
                  ui.row({
                    leading: ui.badge(route.route),
                    title: `${route.from} → ${route.to}`,
                    subtitle: [route.fromPier && route.toPier ? `${route.fromPier} → ${route.toPier}` : null, route.service].filter(Boolean).join(" · ") || null,
                    trailing: route.direction ? ui.chip(route.direction) : null,
                    onclick: () => void app.sendMessage(`Show the next sailings of ${route.operatorName} route ${route.route}${route.direction ? ` ${route.direction}` : ""}.`),
                    hint: "Show the next sailings",
                  }),
                ),
              12,
              "routes",
            ),
          ),
        )
      : ui.empty("No route matches."),
  ];
}

function sailingRow(sailing: Sailing) {
  const eta = fmt.eta(sailing.eta);
  return ui.row({
    leading: ui.badge(fmt.time(sailing.departure)),
    title: `${sailing.from} → ${sailing.to}`,
    subtitle: [
      sailing.fromPier,
      sailing.status === "departed" ? `Arrives ${fmt.time(sailing.eta)}` : `Departs ${fmt.day(sailing.departure)} ${fmt.time(sailing.departure)}`,
      sailing.vessel ? `Vessel ${sailing.vessel}` : null,
      sailing.remark,
    ]
      .filter(Boolean)
      .join(" · "),
    trailing: h(
      "span",
      { class: "chips" },
      sailing.fast ? ui.chip("Fast", "info") : null,
      sailing.status === "departed" ? ui.chip(eta || "Arrived", eta ? "accent" : null) : ui.chip("Scheduled"),
      sailing.position ? ui.mapButton(sailing.position.lat, sailing.position.lng, "") : null,
    ),
  });
}

function arrivals(view: View) {
  const data: Row = view.data ?? {};
  const sailings: Sailing[] = data.sailings ?? [];
  return [
    ui.header({ badge: BADGE, title: data.name ?? "Next sailings", subtitle: [data.operator, data.route ? `route ${data.route}` : null].filter(Boolean).join(" · "), actions: [ui.refreshButton()] }),
    sailings.length ? ui.list(sailings.map(sailingRow)) : ui.empty("No sailing is under way on this route right now."),
    data.updatedAt ? h("footer", { class: "footer" }, `Updated ${fmt.time(data.updatedAt)}`) : null,
  ];
}

function times(title: string, sailings: Array<{ time: string; marks?: string[] }>) {
  return ui.section(
    title,
    sailings.length ? h("div", { class: "chips" }, sailings.map((sailing) => ui.chip(`${sailing.marks?.join("") ?? ""}${sailing.time}`, sailing.marks ? "info" : null))) : ui.empty("No sailings."),
  );
}

function timetable(view: View) {
  const data: Row = view.data ?? {};
  const remarks: Array<{ mark?: string; text: string }> = data.remarks ?? [];
  return [
    ui.header({ badge: BADGE, title: `${data.from ?? "—"} → ${data.to ?? "—"}`, subtitle: `Hong Kong & Kowloon Ferry route ${data.route ?? ""} timetable` }),
    times("Monday to Saturday", data.mondayToSaturday ?? []),
    times("Sundays and public holidays", data.sundayAndHolidays ?? []),
    remarks.length ? ui.section("Remarks", ui.kv(remarks.map((remark) => [remark.mark ?? "•", remark.text]))) : null,
  ];
}

function fares(view: View) {
  const rows: Row[] = Array.isArray(view.data) ? view.data : [];
  return [
    ui.header({ badge: BADGE, title: `HKKF route ${view.input?.route ?? ""} fares`, subtitle: "HK$" }),
    rows.length
      ? ui.table(
          rows.map((row) => ({
            Ticket: row.ticket,
            "Mon–Sat": row.price !== undefined ? money(row.price) : money(row.mondayToSaturday),
            "Sun & holidays": row.price !== undefined ? "" : money(row.sundayAndHolidays),
          })),
        )
      : ui.empty("No fares."),
  ];
}

const views: Record<string, (view: View) => Content> = {
  ferry_routes: routes,
  ferry_arrivals: arrivals,
  hkkf_timetable: timetable,
  hkkf_fares: fares,
};

mount({
  accent: "#0277bd",
  render(view) {
    if (view.status === "loading") return [ui.header({ badge: BADGE, title: "Ferries", subtitle: "Checking the piers…" }), ui.skeleton(3)];
    const draw = view.tool ? views[view.tool] : undefined;
    return draw ? draw(view) : ui.generic(view.data);
  },
});
