// Transport Department car park chat cards: car parks and live vacancy, as still pictures.
import { card, fmt, truncation, type Card, type CardBuilder, type CardInput, type Row, type Tone } from "../../apps/card";

const ACCENT = "#1a4fa0";
const VEHICLES: Record<string, string> = { privateCar: "Car", LGV: "Light goods", HGV: "Heavy goods", CV: "Container", coach: "Coach", motorCycle: "Motorcycle" };

const vacancyTone = (count: number): Tone => (count === 0 ? "danger" : count < 10 ? "warning" : "success");

/** The vacancy record of one vehicle type in a vacancy result row; negative counts mean "not reported". */
function spaces(row: Row, vehicle: string): Row | null {
  const record = row?.[vehicle]?.[0];
  return record && typeof record.vacancy === "number" && record.vacancy >= 0 ? record : null;
}

function info(result: CardInput): Card {
  const parks: Row[] = result.data ?? [];
  const vehicle = result.input?.vehicleTypes ?? "privateCar";
  return {
    accent: ACCENT,
    badge: "P",
    title: result.input?.search ? `Car parks near “${result.input.search}”` : "Car parks",
    subtitle: `${parks.length} found · ${VEHICLES[vehicle] ?? vehicle}`,
    blocks: parks.length
      ? parks.map((park) => {
          const open = park.opening_status === "OPEN";
          const height = park.heightLimits?.[0]?.height;
          return card.row({
            title: park.name,
            subtitle: [park.displayAddress, height ? `max height ${height} m` : null].filter(Boolean).join(" · "),
            trailing: [{ text: open ? "Open" : park.opening_status || "Unknown", tone: open ? "success" : "danger" }],
          });
        })
      : [card.text("No car parks match.", true)],
    footer: truncation(result),
  };
}

function vacancy(result: CardInput): Card {
  const rows: Row[] = result.data ?? [];
  const vehicle = result.input?.vehicleTypes ?? "privateCar";
  return {
    accent: ACCENT,
    badge: "P",
    title: result.input?.parkId ? `Car park ${result.input.parkId}` : "Car park vacancies",
    subtitle: VEHICLES[vehicle] ?? vehicle,
    blocks: rows.length
      ? rows.map((row) => {
          const record = spaces(row, vehicle);
          return card.row({
            leading: { text: String(row.park_Id), tone: "accent" },
            title: record ? `${record.vacancy} spaces free` : "No live count",
            subtitle: record
              ? [record.vacancyEV ? `${record.vacancyEV} EV` : null, record.vacancyDIS ? `${record.vacancyDIS} accessible` : null, record.lastupdate ? `updated ${fmt.ago(record.lastupdate)}` : null]
                  .filter(Boolean)
                  .join(" · ")
              : null,
            trailing: record ? [{ text: record.vacancy === 0 ? "Full" : record.vacancy < 10 ? "Few left" : "Available", tone: vacancyTone(record.vacancy) }] : undefined,
          });
        })
      : [card.text("No vacancy data.", true)],
    footer: truncation(result),
  };
}

const builders: Record<string, CardBuilder> = { carpark_info: info, carpark_vacancy: vacancy };

export const buildCard: CardBuilder = (result) => builders[result.tool]?.(result) ?? null;
