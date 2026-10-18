// Kowloon East parking chat cards: the same views as app.ts, as still pictures.
import { card, fmt, truncation, type Card, type CardBuilder, type CardInput, type Chip, type Tone } from "../../apps/card";
import type { Carpark, CarparkVacancy, Vacancy, VehicleType } from "./handlers";

const ACCENT = "#d9531e";
const base = { accent: ACCENT, badge: "P" };
const VEHICLES: Record<VehicleType, string> = { privateCar: "Car", LGV: "Light goods", HGV: "Heavy goods", coach: "Coach", motorCycle: "Motorcycle" };

const vacancyTone = (vacant: number | null): Tone => (vacant === null ? "neutral" : vacant === 0 ? "danger" : vacant < 10 ? "warning" : "success");

function vacancyChip(type: VehicleType, vacancy: Vacancy): Chip {
  const label = vacancy.vacant === null ? "—" : vacancy.spaces ? `${vacancy.vacant}/${vacancy.spaces}` : String(vacancy.vacant);
  return { text: `${VEHICLES[type] ?? type} ${label}`, tone: vacancyTone(vacancy.vacant) };
}

function carparks(result: CardInput): Card {
  const parks: Carpark[] = Array.isArray(result.data) ? result.data : [];
  const vehicle: VehicleType = result.input?.vehicleType ?? "privateCar";
  return {
    ...base,
    title: result.input?.search ? `Kowloon East car parks: “${result.input.search}”` : "Kowloon East car parks",
    subtitle: `${parks.length} found${result.input?.vehicleType ? ` · ${VEHICLES[vehicle]}` : ""}`,
    blocks: parks.length
      ? parks.slice(0, 10).map((park) => {
          const hourly = (park.vehicles[vehicle]?.prices ?? []).filter((price) => price.type === "hourly" && price.price > 0).map((price) => price.price);
          const spaces = park.vehicles[vehicle]?.spaces;
          return card.row({
            title: park.name,
            subtitle: [park.address ?? park.area, park.heightLimits?.[0] ? `max height ${park.heightLimits[0].metres} m` : null].filter(Boolean).join(" · "),
            trailing: [hourly.length ? { text: `From $${Math.min(...hourly)}/h`, tone: "accent" as Tone } : null, spaces ? { text: `${spaces} spaces` } : null].filter((chip): chip is Chip => Boolean(chip)),
          });
        })
      : [card.text("No car parks match.", true)],
    footer: truncation(result),
  };
}

function vacancy(result: CardInput): Card {
  const parks: CarparkVacancy[] = Array.isArray(result.data) ? result.data : [];
  return {
    ...base,
    title: parks.length === 1 ? parks[0].name : "Kowloon East parking",
    subtitle: parks.length === 1 ? (parks[0].area ?? null) : `${parks.length} car parks`,
    blocks: parks.length
      ? parks.slice(0, 12).map((park) =>
          card.row({
            title: park.name,
            subtitle: [park.area, park.closed ? "Closed" : null, park.updatedAt ? `updated ${fmt.ago(park.updatedAt)}` : null].filter(Boolean).join(" · "),
            trailing: (Object.entries(park.vacancies) as Array<[VehicleType, Vacancy]>).slice(0, 3).map(([type, vacancy]) => vacancyChip(type, vacancy)),
            muted: park.closed,
          }),
        )
      : [card.text("No vacancy data matches.", true)],
    footer: truncation(result, "Free / total spaces"),
  };
}

const builders: Record<string, CardBuilder> = { ke_carparks: carparks, ke_parking_vacancy: vacancy };

export const buildCard: CardBuilder = (result) => builders[result.tool]?.(result) ?? null;
