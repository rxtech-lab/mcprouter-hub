import { spatialQuery, malformed, page } from "@/lib/mcp/spatial";
import type { ToolHandler } from "@/lib/mcp/types";
const query = spatialQuery("pland_rcd_1634281652589_43389", []);

const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

/** Only download the fixed-provider path linked by an actual grid; never accept a caller URL. */
export const profile: ToolHandler = async (input, context) => {
  const grid = await query({ objectId: input.objectId, limit: 1, geometry: false }, context) as { results: Record<string, unknown>[] };
  const season = String(input.season ?? "annual");
  const height = Number(input.height ?? 500);
  if (!grid.results.length) return { objectId: input.objectId, season, height, ...page([], Number(input.offset ?? 0), Number(input.limit ?? 20)) };
  const source = grid.results[0][`${season}_${height}`];
  if (typeof source !== "string" || !new RegExp(`^https://www[.]pland[.]gov[.]hk/pland_en/resources/site_wind/site_wind/table/${season}/g_[0-9]{5}_lev${height}[.]txt$`).test(source)) malformed("Planning Department profile link");
  const body = await context.fetchUpstream(source, { format: "text" });
  if (typeof body !== "string") malformed("Planning Department wind profile");
  const lines = body.trim().split(/\r?\n/).map((line) => line.trimEnd().split("\t"));
  const [header, totals, ...bands] = lines;
  if (!header || !/^g_\d{5}$/.test(header[0]) || !source.endsWith(`/${header[0]}_lev${height}.txt`) ||
      header[1] !== "Wind_direction" || JSON.stringify(header.slice(2)) !== JSON.stringify(directions) ||
      !totals || totals[0] !== "V_infinity(m/s)" || totals[1] !== "Sum" || bands.length !== 24) malformed("Planning Department wind profile header");
  const fractions = (cells: string[]) => {
    if (cells.length !== 16 || cells.some((v) => !/^\d+(\.\d+)?$/.test(v) || Number(v) > 1)) malformed("Planning Department wind fractions");
    return Object.fromEntries(directions.map((d, i) => [d, Number(cells[i])]));
  };
  const directionTotals = fractions(totals.slice(2));
  const rows = bands.map((band, i) => {
    const label = `${String(i).padStart(2, "0")}_to_${String(i + 1).padStart(2, "0")}`;
    if (band.length !== 18 || band[0] !== label || !/^\d+(\.\d+)?$/.test(band[1]) || Number(band[1]) > 1) malformed("Planning Department wind speed band");
    return { speedBand: band[0], sum: Number(band[1]), directions: fractions(band.slice(2)) };
  });
  const offset = Number(input.offset ?? 0);
  return { objectId: input.objectId, grid: header[0], season, height, speedUnit: "m/s", frequencyUnit: "fraction", source,
    directionTotals, total: rows.length, ...page(rows.slice(offset), offset, Number(input.limit ?? 20)) };
};
