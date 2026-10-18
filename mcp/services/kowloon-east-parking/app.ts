// Kowloon East parking MCP App: Smart Parking car parks with their prices, and live free spaces.
import { app, fmt, h, mount, ui, type Content, type Tone, type View } from "../../apps/runtime";
import type { Carpark, CarparkVacancy, Price, Vacancy, VehicleType } from "./handlers";

const ACCENT = "#d9531e";
const VEHICLES: Record<VehicleType, string> = { privateCar: "Car", LGV: "Light goods", HGV: "Heavy goods", coach: "Coach", motorCycle: "Motorcycle" };
const FACILITIES: Record<string, string> = { evCharger: "EV charging", disabilities: "Accessible", unloading: "Loading bay", washing: "Car wash", "valet-parking": "Valet" };

function vacancyTone(vacant: number | null): Tone | null {
  if (vacant === null) return null;
  if (vacant === 0) return "danger";
  return vacant < 10 ? "warning" : "success";
}

function vacancyChip(type: VehicleType, vacancy: Vacancy) {
  const label = vacancy.vacant === null ? "—" : vacancy.spaces ? `${vacancy.vacant}/${vacancy.spaces}` : String(vacancy.vacant);
  return ui.chip(`${VEHICLES[type] ?? type} ${label}`, vacancyTone(vacancy.vacant));
}

function priceLabel(price: Price) {
  const unit = price.type === "hourly" ? "/h" : price.type === "half-hourly" ? "/30 min" : ` ${price.type.replace(/-/g, " ")}`;
  return `$${price.price}${unit}`;
}

/** Cheapest hourly rate, as the one-line price of a car park. */
function fromPrice(park: Carpark, vehicle: VehicleType) {
  const hourly = (park.vehicles[vehicle]?.prices ?? []).filter((price) => price.type === "hourly" && price.price > 0);
  if (!hourly.length) return null;
  return `From $${Math.min(...hourly.map((price) => price.price))}/h`;
}

/** Checks free spaces in place through `tools/call`, or asks in the chat when the host doesn't allow tool calls. */
function vacancyButton(park: Carpark) {
  if (!app.canCallTools) return ui.askButton("Spaces", `How many parking spaces are free at ${park.name} (Kowloon East car park ${park.id})?`);
  const slot = h("span", { class: "chips" });
  const check = ui.button(
    "Check spaces",
    () => {
      check.disabled = true;
      void app.callTool("ke_parking_vacancy", { carparkId: park.id }).then((result) => {
        const live: CarparkVacancy | undefined = Array.isArray(result.data) ? result.data[0] : undefined;
        const entries = Object.entries(live?.vacancies ?? {}) as Array<[VehicleType, Vacancy]>;
        slot.replaceChildren(...(entries.length ? entries.map(([type, vacancy]) => vacancyChip(type, vacancy)) : [ui.chip(result.error ? "Unavailable" : "No live count")]));
      });
    },
    { variant: "tonal" },
  );
  slot.appendChild(check);
  return slot;
}

function prices(park: Carpark) {
  const sections: Content[] = [];
  for (const [type, info] of Object.entries(park.vehicles) as Array<[VehicleType, NonNullable<Carpark["vehicles"][VehicleType]>]>) {
    if (!info.prices?.length && !info.offers?.length) continue;
    sections.push(
      ui.section(
        `${VEHICLES[type] ?? type} · ${info.spaces} spaces`,
        info.prices?.length
          ? ui.table(info.prices.map((price) => ({ Price: priceLabel(price), Days: price.days ?? "", Hours: price.hours ?? "", Note: [price.covered, price.reserved, price.remark].filter(Boolean).join(" · ") })))
          : null,
        (info.offers ?? []).map((offer) => ui.notice(`${offer.days}${offer.hours ? ` ${offer.hours}` : ""}: ${offer.description}`, "info")),
      ),
    );
  }
  return sections;
}

function carparks(view: View) {
  const parks: Carpark[] = Array.isArray(view.data) ? view.data : [];
  const vehicle: VehicleType = view.input.vehicleType ?? "privateCar";
  const detailed = parks.length === 1;
  return [
    ui.header({ badge: "P", title: view.input.search ? `Kowloon East car parks: “${view.input.search}”` : "Kowloon East car parks", subtitle: `${parks.length} found${view.input.vehicleType ? ` · ${VEHICLES[vehicle]}` : ""}` }),
    parks.length
      ? ui.more(
          parks.map((park) =>
            h(
              "div",
              { class: "row", style: { flexDirection: "column", alignItems: "stretch", gap: "6px" } },
              h("span", { class: "row-text" }, h("span", { class: "row-title" }, park.name), h("span", { class: "row-subtitle" }, park.address ?? park.area ?? "")),
              h(
                "div",
                { class: "chips" },
                fromPrice(park, vehicle) ? ui.chip(fromPrice(park, vehicle)!, "accent") : null,
                (Object.entries(park.vehicles) as Array<[VehicleType, { spaces: number }]>).map(([type, info]) => ui.chip(`${VEHICLES[type] ?? type} ${info.spaces}`)),
                park.openingHours?.[0] ? ui.chip(park.openingHours.length === 1 && park.openingHours[0] === "Daily 24 hours" ? "Open 24 hours" : park.openingHours.join("; ")) : null,
                park.heightLimits?.[0] ? ui.chip(`Max height ${park.heightLimits[0].metres} m`) : null,
                (park.facilities ?? []).map((facility) => ui.chip(FACILITIES[facility] ?? facility)),
              ),
              h("div", { class: "actions" }, vacancyButton(park), ui.mapButton(park.latitude, park.longitude, "Directions"), ui.linkButton("Website", park.website)),
              detailed ? prices(park) : null,
            ),
          ),
          5,
          "car parks",
        )
      : ui.empty("No car parks match."),
    ui.footer(view),
  ];
}

function vacancy(view: View) {
  const parks: CarparkVacancy[] = Array.isArray(view.data) ? view.data : [];
  const free = parks.reduce((total, park) => total + (park.vacancies.privateCar?.vacant ?? 0), 0);
  return [
    ui.header({ badge: "P", title: parks.length === 1 ? parks[0].name : "Kowloon East parking", subtitle: parks.length === 1 ? parks[0].area : `${parks.length} car parks`, actions: [ui.refreshButton()] }),
    parks.length > 1 && !view.input.vehicleType ? h("div", { class: "stats" }, h("div", { class: "stat" }, h("div", { class: "stat-label" }, "Free car spaces"), h("div", { class: "stat-value" }, free.toLocaleString("en-HK")))) : null,
    parks.length
      ? ui.more(
          parks.map((park) =>
            ui.row({
              title: park.name,
              subtitle: [park.area, park.closed ? "Closed" : null, park.updatedAt ? `updated ${fmt.ago(park.updatedAt)}` : null].filter(Boolean).join(" · "),
              trailing: h("span", { class: "chips" }, (Object.entries(park.vacancies) as Array<[VehicleType, Vacancy]>).map(([type, vacancy]) => vacancyChip(type, vacancy))),
            }),
          ),
          8,
          "car parks",
        )
      : ui.empty("No vacancy data matches."),
    h("footer", { class: "footer" }, "Free / total spaces. Each car park reports on its own schedule."),
  ];
}

mount({
  accent: ACCENT,
  render(view) {
    if (view.status === "loading") return [ui.header({ badge: "P", title: view.input.search || "Kowloon East parking", subtitle: "Checking car parks…" }), ui.skeleton(3)];
    if (view.tool === "ke_carparks") return carparks(view);
    if (view.tool === "ke_parking_vacancy") return vacancy(view);
    return ui.generic(view.data);
  },
});
