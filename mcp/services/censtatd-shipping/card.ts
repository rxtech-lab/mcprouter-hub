// Census and Statistics Department Hong Kong Shipping Statistics chat cards.
import { card, truncation, type Card, type CardBuilder, type CardInput, type Row, type Tone } from "../../apps/card";

const ACCENT = "#0f766e";

const TITLES: Record<string, string> = {
  shipping_port_cargo_throughput: "Port Cargo Throughput",
  shipping_seaborne_cargo_throughput: "Seaborne Cargo Throughput",
  shipping_seaborne_cargo_monthly: "Seaborne Cargo by Month",
  shipping_river_cargo_throughput: "River Cargo Throughput",
  shipping_river_cargo_monthly: "River Cargo by Month",
  shipping_port_cargo_seasonally_adjusted: "Seasonally Adjusted Port Cargo",
  shipping_port_cargo_gba_city: "Port Cargo by GBA City",
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

function buildShippingCard(result: CardInput): Card {
  const rows: Row[] = Array.isArray(result.data) ? result.data : [];
  const title = TITLES[result.tool] ?? "Hong Kong Shipping Statistics";
  const subtitle = [
    result.input?.period ? `Period ${result.input.period}` : "Latest periods",
    result.input?.freq ? `Freq ${result.input.freq}` : null,
    result.input?.city ? `City: ${result.input.city}` : null,
    `${rows.length} rows`,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    accent: ACCENT,
    badge: "SHIP",
    title,
    subtitle,
    blocks: rows.length
      ? rows.map((row) => {
          const label = row.COUNTRYDesc
            ? String(row.COUNTRYDesc)
            : [row.DIRECTIONDesc || row.DIRECTION, row.SHIPMENT_TYPEDesc || row.SHIPMENT_TYPE].filter(Boolean).join(" · ");
          const sub = [row.TRANSDesc, row.svDesc, row.sd_value ? `Note: ${row.sd_value}` : null].filter(Boolean).join(" · ");
          return card.row({
            leading: { text: `${row.freq ? `${row.freq} ` : ""}${row.period ?? ""}`.trim(), tone: "accent" },
            title: label || "Total",
            subtitle: sub,
            trailing: [{ text: formatFigure(row), tone: figureTone(row) }],
          });
        })
      : [card.text("No matching shipping statistics found.", true)],
    footer: truncation(result),
  };
}

export const buildCard: CardBuilder = (result) => (result.tool in TITLES ? buildShippingCard(result) : null);
