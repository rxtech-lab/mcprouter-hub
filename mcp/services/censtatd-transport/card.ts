// Census and Statistics Department Hong Kong Transport & Postal Statistics chat cards.
import { card, truncation, type Card, type CardBuilder, type CardInput, type Row, type Tone } from "../../apps/card";

const ACCENT = "#1d4ed8";

const TITLES: Record<string, string> = {
  air_cargo_movements: "Air Cargo Movements",
  postal_services_statistics: "Postal Services Statistics",
  air_transport_capacity: "Air Transport Service Capacity",
  seafarers_statistics: "Seafarers Statistics",
  airport_arrival_transit_passengers: "Airport Arrival Transit Passengers",
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

function rowTitle(row: Row): string {
  if (row.REGIONDesc || row.DIRECTIONDesc) {
    return [row.REGIONDesc || row.REGION, row.DIRECTIONDesc || row.DIRECTION].filter(Boolean).join(" · ");
  }
  if (row.PMDesc) {
    return [row.indicatorDesc || row.sv, row.PMDesc].filter(Boolean).join(" · ");
  }
  return String(row.indicatorDesc || row.sv || "Total");
}

function buildTransportCard(result: CardInput): Card {
  const rows: Row[] = Array.isArray(result.data) ? result.data : [];
  const title = TITLES[result.tool] ?? "Hong Kong Transport Statistics";
  const subtitle = [
    result.input?.period ? `Period ${result.input.period}` : "Latest periods",
    result.input?.freq ? `Freq ${result.input.freq}` : null,
    result.input?.region ? `Region: ${result.input.region}` : null,
    result.input?.indicator ? `${result.input.indicator}` : null,
    `${rows.length} rows`,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    accent: ACCENT,
    badge: "C&SD",
    title,
    subtitle,
    blocks: rows.length
      ? rows.map((row) => {
          const sub = [row.svDesc, row.sd_value ? `Note: ${row.sd_value}` : null].filter(Boolean).join(" · ");
          return card.row({
            leading: { text: `${row.freq ? `${row.freq} ` : ""}${row.period ?? ""}`.trim(), tone: "accent" },
            title: rowTitle(row),
            subtitle: sub,
            trailing: [{ text: formatFigure(row), tone: figureTone(row) }],
          });
        })
      : [card.text("No matching transport statistics found.", true)],
    footer: truncation(result),
  };
}

export const buildCard: CardBuilder = (result) => (result.tool in TITLES ? buildTransportCard(result) : null);
