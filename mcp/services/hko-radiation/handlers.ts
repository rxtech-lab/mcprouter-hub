import { csvDataset } from "@/lib/mcp/csv-dataset";
import { malformed, page, record } from "@/lib/mcp/spatial";
import type { ToolHandler } from "@/lib/mcp/types";

const base = "https://data.weather.gov.hk/weatherAPI/";
const matches = (value: unknown, search: unknown) => JSON.stringify(value).toLowerCase().includes(String(search ?? "").trim().toLowerCase());

export const hourly: ToolHandler = async (input, context) => {
  const lang = String(input.lang ?? "en");
  const suffix = { en: "", tc: "_uc", sc: "_sc" }[lang] ?? "";
  const source = `${base}hko_data/regional-weather/latest_hourly_rmn${suffix}.csv`;
  const firstHeader = { en: "Date time", tc: "日期 時間", sc: "日期 时间" }[lang] ?? "Date time";
  const rows = csvDataset(await context.fetchUpstream(source, { format: "text" }), "HKO hourly radiation", firstHeader, 3);
  const readings = rows.map(([time, station, value]) => {
    // Preserve source missing-value markers instead of converting them to zero.
    if (!/^\d{10}$/.test(time) || !station || !/^(?:\d+(?:\.\d+)?|M|N\/A|-)?$/.test(value)) malformed("HKO hourly radiation");
    return { time, station, microsievertsPerHour: value && !["M", "N/A", "-"].includes(value) ? Number(value) : null, sourceValue: value };
  }).filter((row) => matches(row, input.search));
  const offset = Number(input.offset ?? 0);
  return { ...page(readings.slice(offset), offset, Number(input.limit ?? 20)), source, timeZone: "Asia/Hong_Kong", provisional: true };
};

export const daily: ToolHandler = async (input, context) => {
  const date = String(input.date ?? new Date(Date.now() + 8 * 3600_000 - 86400_000).toISOString().slice(0, 10).replaceAll("-", ""));
  const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (!/^\d{8}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) {
    throw new Error("date must be a real calendar date in YYYYMMDD format.");
  }
  const source = `${base}opendata/opendata.php?dataType=RYES&lang=${String(input.lang ?? "en")}&date=${date}`;
  const body = await context.fetchUpstream(source);
  if (!record(body) || typeof body.ReportTimeInfoDate !== "string" || !/^\d{8}$/.test(body.ReportTimeInfoDate) ||
      typeof body.HongKongDesc !== "string" || !Object.keys(body).some((key) => key.endsWith("LocationName")) ||
      Object.values(body).some((value) => typeof value !== "string")) malformed("HKO daily radiation");
  const stations = Object.entries(body).filter(([key]) => key.endsWith("LocationName")).map(([key, station]) => {
    const prefix = key.slice(0, -"LocationName".length);
    return { station, fields: Object.fromEntries(Object.entries(body).filter(([field]) => field.startsWith(prefix) && field !== key)) };
  }).filter((row) => matches(row, input.search));
  const offset = Number(input.offset ?? 0);
  return { ...page(stations.slice(offset), offset, Number(input.limit ?? 20)), source, requestedDate: date,
    reportDate: body.ReportTimeInfoDate, bulletinDate: body.BulletinDate, bulletinTime: body.BulletinTime,
    description: body.HongKongDesc, notes: Object.fromEntries(Object.entries(body).filter(([key]) => key.startsWith("NoteDesc"))),
    observatoryReadings: Object.fromEntries(Object.entries(body).filter(([key]) => key.startsWith("HKOReadings"))), provisional: true };
};
