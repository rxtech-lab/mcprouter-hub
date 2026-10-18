// On-street parking MCP App: live metered and sensor parking vacancy by street.
import { app, fmt, h, mount, ui, type Row, type Tone, type View } from "../../apps/runtime";
import type { Counts, MeteredSpaceRow, SensorSection, Status, StreetSummary, VehicleType } from "./handlers";

const VEHICLES: Record<VehicleType, string> = { car: "Car", goods: "Goods vehicle", coach: "Coach", disabled: "Disabled" };
const STATUSES: Record<Status, [string, Tone | null]> = { vacant: ["Vacant", "success"], occupied: ["Occupied", "danger"], not_in_use: ["Not in use", null], no_data: ["No data", null] };

function vacancyTone(vacant: number): Tone {
  if (vacant === 0) return "danger";
  if (vacant < 3) return "warning";
  return "success";
}

const free = (counts: Counts) => ui.chip(`${counts.vacant} free`, vacancyTone(counts.vacant));

function stats(total: Counts | undefined) {
  if (!total) return null;
  return h(
    "div",
    { class: "stats" },
    [
      ["Vacant", total.vacant],
      ["Occupied", total.occupied],
      ["Spaces", total.spaces],
    ].map(([label, value]) => h("div", { class: "stat" }, h("div", { class: "stat-label" }, String(label)), h("div", { class: "stat-value" }, Number(value).toLocaleString("en-HK")))),
  );
}

/** Lists the spaces of a street in place through `tools/call`, or asks in the chat when the host doesn't allow tool calls. */
function spacesButton(street: StreetSummary) {
  if (!app.canCallTools) return ui.askButton("Spaces", `Which metered spaces on ${street.street} (${street.district}) are vacant now?`);
  return ui.button("Vacant spaces", () => void app.callTool("parking_meter_spaces", { street: street.street, district: street.district, vehicleType: street.vehicleType, status: "vacant", lang: app.lang }), { variant: "text" });
}

function streetRow(street: StreetSummary) {
  return ui.row({
    leading: street.distanceMeters !== undefined ? ui.badge(`${street.distanceMeters} m`) : null,
    title: street.street,
    subtitle: [street.district, street.vehicleType !== "car" ? VEHICLES[street.vehicleType] : null, street.hours[0], street.hourlyRate.length ? `HK$${street.hourlyRate.join("/")} per hour` : null].filter(Boolean).join(" · "),
    trailing: h("span", { class: "chips" }, free(street), h("span", { class: "muted" }, `of ${street.spaces}`), ui.mapButton(street.latitude, street.longitude), spacesButton(street)),
  });
}

function vacancy(view: View) {
  const data: Row = view.data ?? {};
  const place = [view.input.street, view.input.district].filter(Boolean).join(", ");
  const streets: StreetSummary[] = data.streets ?? [];
  const districts: Row[] = data.districts ?? [];
  return [
    ui.header({ badge: "P", title: place ? `Metered parking: ${place}` : "Metered parking", subtitle: data.updated ? `Updated ${fmt.time(data.updated)}` : null, actions: [ui.refreshButton()] }),
    stats(data.total),
    data.streets
      ? streets.length
        ? ui.more(streets.map(streetRow), 8, "streets")
        : ui.empty("No metered spaces match.")
      : ui.list(districts.map((district) => ui.row({ title: district.district, subtitle: `${district.occupied} occupied of ${district.spaces}`, trailing: free(district) }))),
    data.streetsMatched > streets.length ? h("footer", { class: "footer" }, `Showing ${streets.length} of ${data.streetsMatched} streets`) : null,
  ];
}

function spaces(view: View) {
  const rows: MeteredSpaceRow[] = Array.isArray(view.data) ? view.data : [];
  const vacant = rows.filter((space) => space.status === "vacant").length;
  return [
    ui.header({ badge: "P", title: `Metered spaces: ${view.input.street ?? ""}`, subtitle: `${vacant} vacant of ${rows.length}`, actions: [ui.refreshButton()] }),
    rows.length
      ? ui.more(
          rows.map((space) => {
            const [label, tone] = STATUSES[space.status] ?? STATUSES.no_data;
            return ui.row({
              leading: ui.badge(space.id),
              title: space.section || space.street,
              subtitle: [space.since ? `since ${fmt.dateTime(space.since)}` : null, space.hours, space.maxStayMinutes ? `max ${space.maxStayMinutes} min` : null].filter(Boolean).join(" · "),
              trailing: h("span", { class: "chips" }, ui.chip(label, tone), ui.mapButton(space.latitude, space.longitude)),
            });
          }),
          10,
          "spaces",
        )
      : ui.empty("No metered spaces match."),
    ui.footer(view),
  ];
}

function nearby(view: View) {
  const data: Row = view.data ?? {};
  const streets: StreetSummary[] = data.streets ?? [];
  return [
    ui.header({ badge: "P", title: "Metered parking nearby", subtitle: `Within ${data.radiusMeters ?? view.input.radius ?? 300} m${data.updated ? ` · updated ${fmt.time(data.updated)}` : ""}`, actions: [ui.refreshButton()] }),
    stats(data.total),
    streets.length ? ui.more(streets.map(streetRow), 8, "streets") : ui.empty("No metered spaces within the radius. Try a larger one."),
  ];
}

function sensors(view: View) {
  const data: Row = view.data ?? {};
  const sections: SensorSection[] = data.sections ?? [];
  return [
    ui.header({ badge: "P", title: "Non-metered parking with sensors", subtitle: `${data.total?.vacant ?? 0} vacant of ${data.total?.spaces ?? 0} spaces`, actions: [ui.refreshButton()] }),
    sections.length
      ? ui.more(
          sections.map((section) =>
            ui.row({
              leading: ui.badge(section.site),
              title: section.section,
              subtitle: [section.district, VEHICLES[section.vehicleType], section.notInUse ? `${section.notInUse} not in use` : null].filter(Boolean).join(" · "),
              trailing: h("span", { class: "chips" }, free(section), h("span", { class: "muted" }, `of ${section.spaces}`), ui.mapButton(section.latitude, section.longitude)),
            }),
          ),
          8,
          "sections",
        )
      : ui.empty("No sensor parking matches."),
  ];
}

const views: Record<string, (view: View) => ReturnType<typeof vacancy>> = {
  parking_meter_vacancy: vacancy,
  parking_meter_spaces: spaces,
  parking_meter_nearby: nearby,
  parking_sensor_vacancy: sensors,
};

mount({
  accent: "#1a4fa0",
  render(view) {
    if (view.status === "loading") return [ui.header({ badge: "P", title: "On-street parking", subtitle: "Checking the meters…" }), ui.skeleton(3)];
    const draw = view.tool ? views[view.tool] : undefined;
    return draw ? draw(view) : ui.generic(view.data);
  },
});
