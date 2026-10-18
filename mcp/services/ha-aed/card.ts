// Hospital Authority A&E chat card: hospitals ranked by waiting time, as a still picture.
import { card, type Card, type CardBuilder, type Row, type Tone } from "../../apps/card";
import { toMinutes } from "./waits";

function toneFor(minutes: number | null): Tone {
  if (minutes === null) return "neutral";
  if (minutes <= 60) return "success";
  if (minutes <= 150) return "warning";
  return "danger";
}

export const buildCard: CardBuilder = ({ tool, input, data }): Card | null => {
  if (tool !== "ha_aed_waiting_times") return null;
  const hospitals: Array<{ hospital: Row; standard: number | null }> = ((Array.isArray(data) ? data : data?.waitTime) ?? []).map((hospital: Row) => ({
    hospital,
    standard: toMinutes(hospital.t45p50),
  }));
  hospitals.sort((a, b) => (a.standard ?? Infinity) - (b.standard ?? Infinity));
  return {
    accent: "#00796b",
    badge: "A&E",
    title: input?.hospital ? `A&E matching “${input.hospital}”` : "A&E waiting times",
    subtitle: "Shortest semi-urgent wait first",
    blocks: hospitals.length
      ? hospitals.map(({ hospital, standard }) =>
          card.row({
            title: hospital.hospName,
            subtitle: [
              `Urgent ${hospital.t3p50 || "—"}`,
              hospital.manageT1case === "Y" ? "handling a critical case" : null,
              hospital.manageT2case === "Y" ? "handling an emergency case" : null,
            ]
              .filter(Boolean)
              .join(" · "),
            trailing: [{ text: hospital.t45p50 || "—", tone: toneFor(standard) }],
          }),
        )
      : [card.text("No hospitals match.", true)],
    footer: "Median waits. Critical and emergency cases are seen first.",
  };
};
