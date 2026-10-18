// On-street parking chat cards: the same views as app.ts, as still pictures.
import { blocks, card, fmt, truncation, type Card, type CardBuilder, type CardInput, type Chip, type Row, type Tone } from "../../apps/card";
import type { Counts, MeteredSpaceRow, SensorSection, Status, StreetSummary, VehicleType } from "./handlers";

const ACCENT = "#1a4fa0";
const base = { accent: ACCENT, badge: "P" };

const VEHICLES: Record<VehicleType, string> = { car: "Car", goods: "Goods vehicle", coach: "Coach", disabled: "Disabled" };
const STATUSES: Record<Status, Chip> = { vacant: { text: "Vacant", tone: "success" }, occupied: { text: "Occupied", tone: "danger" }, not_in_use: { text: "Not in use" }, no_data: { text: "No data" } };

function vacancyTone(vacant: number): Tone {
  if (vacant === 0) return "danger";
  if (vacant < 3) return "warning";
  return "success";
}

const free = (counts: Counts): Chip[] => [{ text: `${counts.vacant} free`, tone: vacancyTone(counts.vacant) }, { text: `of ${counts.spaces}` }];

const stats = (total: Counts | undefined) =>
  total && card.stats([{ label: "Vacant", value: total.vacant.toLocaleString("en-HK") }, { label: "Occupied", value: total.occupied.toLocaleString("en-HK") }, { label: "Spaces", value: total.spaces.toLocaleString("en-HK") }]);

function streetRow(street: StreetSummary) {
  return card.row({
    leading: street.distanceMeters !== undefined ? { text: `${street.distanceMeters} m` } : undefined,
    title: street.street,
    subtitle: [street.district, street.vehicleType !== "car" ? VEHICLES[street.vehicleType] : null, street.hours[0]].filter(Boolean).join(" · "),
    trailing: free(street),
  });
}

function vacancy({ input = {}, data = {} }: CardInput): Card {
  const place = [input.street, input.district].filter(Boolean).join(", ");
  const streets: StreetSummary[] = data.streets ?? [];
  const districts: Row[] = data.districts ?? [];
  return {
    ...base,
    title: place ? `Metered parking: ${place}` : "Metered parking",
    subtitle: data.updated ? `Updated ${fmt.time(data.updated)}` : null,
    blocks: blocks(
      stats(data.total),
      data.streets
        ? streets.length
          ? streets.slice(0, 10).map(streetRow)
          : card.text("No metered spaces match.", true)
        : districts.map((district) => card.row({ title: district.district, trailing: free(district) })),
    ),
    footer: data.streetsMatched > Math.min(streets.length, 10) ? `Showing ${Math.min(streets.length, 10)} of ${data.streetsMatched} streets` : null,
  };
}

function spaces(result: CardInput): Card {
  const rows: MeteredSpaceRow[] = Array.isArray(result.data) ? result.data : [];
  const vacant = rows.filter((space) => space.status === "vacant").length;
  return {
    ...base,
    title: `Metered spaces: ${result.input?.street ?? ""}`,
    subtitle: `${vacant} vacant of ${rows.length}`,
    blocks: rows.length
      ? rows.slice(0, 12).map((space) =>
          card.row({
            leading: { text: space.id },
            title: space.section || space.street,
            subtitle: space.since ? `Since ${fmt.dateTime(space.since)}` : null,
            trailing: [STATUSES[space.status] ?? STATUSES.no_data],
          }),
        )
      : [card.text("No metered spaces match.", true)],
    footer: truncation(result),
  };
}

function nearby({ input = {}, data = {} }: CardInput): Card {
  const streets: StreetSummary[] = data.streets ?? [];
  return {
    ...base,
    title: "Metered parking nearby",
    subtitle: `Within ${data.radiusMeters ?? input.radius ?? 300} m${data.updated ? ` · updated ${fmt.time(data.updated)}` : ""}`,
    blocks: blocks(stats(data.total), streets.length ? streets.slice(0, 10).map(streetRow) : card.text("No metered spaces within the radius.", true)),
  };
}

function sensors({ data = {} }: CardInput): Card {
  const sections: SensorSection[] = data.sections ?? [];
  return {
    ...base,
    title: "Non-metered parking with sensors",
    subtitle: `${data.total?.vacant ?? 0} vacant of ${data.total?.spaces ?? 0} spaces`,
    blocks: sections.length
      ? sections.slice(0, 12).map((section) =>
          card.row({ leading: { text: section.site }, title: section.section, subtitle: [section.district, VEHICLES[section.vehicleType]].filter(Boolean).join(" · "), trailing: free(section) }),
        )
      : [card.text("No sensor parking matches.", true)],
  };
}

const builders: Record<string, CardBuilder> = {
  parking_meter_vacancy: vacancy,
  parking_meter_spaces: spaces,
  parking_meter_nearby: nearby,
  parking_sensor_vacancy: sensors,
};

export const buildCard: CardBuilder = (result) => builders[result.tool]?.(result) ?? null;
