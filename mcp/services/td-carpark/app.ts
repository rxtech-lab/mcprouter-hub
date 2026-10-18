// Transport Department car park MCP App: car park cards with live vacancy.
import { app, fmt, h, mount, ui, type Row, type Tone, type View } from "../../apps/runtime";

const FACILITIES: Record<string, string> = { evCharger: "EV charging", disabilities: "Accessible", unloading: "Loading bay", washing: "Car wash" };
const VEHICLES: Record<string, string> = { privateCar: "Car", LGV: "Light goods", HGV: "Heavy goods", CV: "Container", coach: "Coach", motorCycle: "Motorcycle" };

function vacancyTone(count: number): Tone {
  if (count === 0) return "danger";
  if (count < 10) return "warning";
  return "success";
}

/** The vacancy record of one vehicle type in a vacancy result row; negative counts mean "not reported". */
function spaces(row: Row, vehicle: string): Row | null {
  const record = row?.[vehicle]?.[0];
  return record && typeof record.vacancy === "number" && record.vacancy >= 0 ? record : null;
}

function hours(park: Row) {
  const periods: Row[] = park.openingHours ?? [];
  if (periods.some((period) => period.periodStart === "00:00" && period.periodEnd === "24:00" && (period.weekdays ?? []).length >= 7)) return "Open 24 hours";
  return periods
    .slice(0, 2)
    .map((period) => `${(period.weekdays ?? []).join(", ")} ${period.periodStart}–${period.periodEnd}`)
    .join("; ");
}

/** Checks spaces in place through `tools/call`, or asks in the chat when the host doesn't allow tool calls. */
function vacancyButton(park: Row, vehicle: string) {
  if (!app.canCallTools) {
    return ui.askButton("Spaces", `How many ${(VEHICLES[vehicle] ?? "car").toLowerCase()} spaces are free at ${park.name} (car park ${park.park_Id})?`);
  }
  const slot = h("span", null);
  const check = ui.button(
    "Check spaces",
    () => {
      check.disabled = true;
      void app.callTool("carpark_vacancy", { parkId: park.park_Id, vehicleTypes: vehicle }).then((result) => {
        const record = spaces(Array.isArray(result.data) ? result.data[0] : null, vehicle);
        slot.replaceChildren(record ? ui.chip(`${record.vacancy} free`, vacancyTone(record.vacancy)) : ui.chip(result.error ? "Unavailable" : "No live count"));
      });
    },
    { variant: "tonal" },
  );
  slot.appendChild(check);
  return slot;
}

function info(view: View) {
  const parks: Row[] = view.data ?? [];
  const vehicle = view.input.vehicleTypes ?? "privateCar";
  return [
    ui.header({ badge: "P", title: view.input.search ? `Car parks near “${view.input.search}”` : "Car parks", subtitle: `${parks.length} found · ${VEHICLES[vehicle] ?? vehicle}` }),
    parks.length
      ? ui.more(
          parks.map((park) => {
            const height = park.heightLimits?.[0];
            const open = park.opening_status === "OPEN";
            return h(
              "div",
              { class: "row", style: { flexDirection: "column", alignItems: "stretch", gap: "6px" } },
              h(
                "div",
                { style: { display: "flex", gap: "8px", alignItems: "flex-start", justifyContent: "space-between" } },
                h("span", { class: "row-text" }, h("span", { class: "row-title" }, park.name), h("span", { class: "row-subtitle" }, park.displayAddress)),
                ui.chip(open ? "Open" : park.opening_status || "Unknown", open ? "success" : "danger"),
              ),
              h(
                "div",
                { class: "chips" },
                hours(park) ? ui.chip(hours(park)) : null,
                height?.height ? ui.chip(`Max height ${height.height} m`) : null,
                (park.facilities ?? []).map((facility: string) => ui.chip(FACILITIES[facility] ?? facility)),
              ),
              h("div", { class: "actions" }, vacancyButton(park, vehicle), ui.mapButton(park.latitude, park.longitude, "Directions"), ui.linkButton("Website", park.website)),
            );
          }),
          5,
          "car parks",
        )
      : ui.empty("No car parks match."),
    ui.footer(view),
  ];
}

function vacancy(view: View) {
  const rows: Row[] = view.data ?? [];
  const vehicle = view.input.vehicleTypes ?? "privateCar";
  return [
    ui.header({ badge: "P", title: view.input.parkId ? `Car park ${view.input.parkId}` : "Car park vacancies", subtitle: VEHICLES[vehicle] ?? vehicle, actions: [ui.refreshButton()] }),
    rows.length
      ? ui.more(
          rows.map((row) => {
            const record = spaces(row, vehicle);
            return ui.row({
              leading: ui.badge(String(row.park_Id)),
              title: record ? `${record.vacancy} spaces free` : "No live count",
              subtitle: record
                ? [record.vacancyEV ? `${record.vacancyEV} EV` : null, record.vacancyDIS ? `${record.vacancyDIS} accessible` : null, record.lastupdate ? `updated ${fmt.ago(record.lastupdate)}` : null]
                    .filter(Boolean)
                    .join(" · ")
                : null,
              trailing: record ? ui.chip(record.vacancy === 0 ? "Full" : record.vacancy < 10 ? "Few left" : "Available", vacancyTone(record.vacancy)) : null,
            });
          }),
          8,
          "car parks",
        )
      : ui.empty("No vacancy data."),
    ui.footer(view),
  ];
}

mount({
  accent: "#1a4fa0",
  render(view) {
    if (view.status === "loading") return [ui.header({ badge: "P", title: view.input.search || "Car parks", subtitle: "Checking car parks…" }), ui.skeleton(3)];
    if (view.tool === "carpark_info") return info(view);
    if (view.tool === "carpark_vacancy") return vacancy(view);
    return ui.generic(view.data);
  },
});
