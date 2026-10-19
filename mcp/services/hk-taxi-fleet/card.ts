// Licensed Taxi Fleets (Amigo & Big Boss Taxi) chat cards.
import { card, fmt, truncation, type Card, type CardBuilder, type CardInput, type Row, type Tone } from "../../apps/card";

const ACCENT = "#d97706";

function statusTone(status: string): Tone {
  if (status === "V") return "success";
  if (status === "O") return "warning";
  return "danger";
}

function buildFleetCard(result: CardInput, fleetName: string, badge: string): Card {
  const taxis: Row[] = Array.isArray(result.data) ? result.data : [];
  const subtitle = [
    `${taxis.length} vehicles`,
    result.input?.status ? `Status ${result.input.status}` : null,
    result.input?.taxiType ? `Type ${result.input.taxiType}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    accent: ACCENT,
    badge,
    title: `${fleetName} Fleet`,
    subtitle,
    blocks: taxis.length
      ? taxis.map((taxi) => {
          const details = [
            taxi.taxi_type_label || taxi.taxi_type,
            taxi.passenger_cap ? `${taxi.passenger_cap} seats` : null,
            typeof taxi.distance_km === "number" ? `${taxi.distance_km} km` : null,
            taxi.time_stamp ? fmt.ago(taxi.time_stamp) : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return card.row({
            leading: { text: String(taxi.taxi_type || "T"), tone: "accent" },
            title: String(taxi.veh_id || "Taxi"),
            subtitle: details,
            trailing: [{ text: String(taxi.status_label || taxi.op_status || "Unknown"), tone: statusTone(String(taxi.op_status)) }],
          });
        })
      : [card.text("No matching fleet taxis found.", true)],
    footer: truncation(result),
  };
}

const builders: Record<string, CardBuilder> = {
  amigo_taxi_fleet: (result) => buildFleetCard(result, "Amigo", "AMG"),
  big_boss_taxi_fleet: (result) => buildFleetCard(result, "Big Boss Taxi", "BBT"),
};

export const buildCard: CardBuilder = (result) => builders[result.tool]?.(result) ?? null;
