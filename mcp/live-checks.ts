import type { ToolResult } from "@/lib/mcp/runtime";
import type { ToolInput } from "@/lib/mcp/types";

/**
 * Inputs for the scheduled live check (`bun run live-check`), which calls every
 * tool against its real upstream and renders the result in its MCP App. Every
 * generated tool needs an entry here; a unit test fails when one is missing.
 *
 * Use ids that stay valid for years (major stops, stations, datasets). When an
 * id can't be relied on, derive the input from another tool's live result.
 */

/** Runs another tool live (no retries), for inputs that depend on today's data. */
export type CallTool = (tool: string, input: ToolInput) => Promise<ToolResult>;

export type LiveCase = {
  input: ToolInput | ((call: CallTool) => Promise<ToolInput>);
  /** Extra assertion on the result; return a message to fail the check. */
  check?: (result: ToolResult) => string | null;
};

/** YYYYMMDD in Hong Kong, `days` from today. */
export function hkDate(days = 0, now = new Date()) {
  const date = new Date(now.getTime() + days * 86_400_000);
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" }).replaceAll("-", "");
}

const dashed = (yyyymmdd: string) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6)}`;

/** Fails when a list tool comes back empty, which for these feeds means the upstream broke. */
const nonEmpty = (result: ToolResult) => (Array.isArray(result.data) && result.data.length === 0 ? "Returned no rows" : null);

const first = <T>(value: unknown, what: string): T => {
  const item = Array.isArray(value) ? value[0] : undefined;
  if (!item) throw new Error(`No ${what} to test with`);
  return item as T;
};

const versionsOf = (result: ToolResult): string[] => (result.data as { timestamps?: string[] } | null)?.timestamps ?? [];

/** A recent archived Transport Department CSV, for the archive tools. */
async function archivedFile(call: CallTool) {
  const start = hkDate(-7);
  const end = hkDate(-1);
  const files = await call("datagovhk_archive_list_files", { start, end, provider: "hk-td", format: "csv", max: 1 });
  const file = first<{ url: string }>(files.data, "archived file");
  return { url: file.url, start, end };
}

export const liveCases: Record<string, LiveCase> = {
  // datagovhk-catalog
  datagovhk_search_datasets: { input: { query: "weather" }, check: nonEmpty },
  datagovhk_dataset_details: { input: { id: "hk-hko-rss-current-weather-report" } },
  datagovhk_get_resource: { input: { dataset: "hk-hko-rss-current-weather-report", maxChars: 1000 } },
  datagovhk_archive_list_files: { input: { start: hkDate(-7), end: hkDate(-1), provider: "hk-td", max: 5 }, check: nonEmpty },
  datagovhk_archive_file_versions: { input: archivedFile, check: (result) => (versionsOf(result).length ? null : "Returned no versions") },
  datagovhk_archive_get_file: {
    input: async (call) => {
      const file = await archivedFile(call);
      const versions = await call("datagovhk_archive_file_versions", file);
      return { url: file.url, time: first<string>(versionsOf(versions), "archived version"), maxChars: 1000 };
    },
  },
  datagovhk_filter_csv: {
    // A finished dataset, so the file won't change; most CSVs aren't enabled for the filter API.
    input: { resource: "http://www.chp.gov.hk/files/misc/latest_situation_of_reported_cases_covid_19_eng.csv", limit: 5 },
    check: nonEmpty,
  },

  // ha-aed
  ha_aed_waiting_times: { input: {}, check: nonEmpty },

  // hk-border
  border_waiting_times: { input: {}, check: nonEmpty },
  border_daily_passengers: { input: {}, check: nonEmpty },
  border_annual_traffic: { input: {} },
  border_passenger_throughput: { input: {} },
  border_vehicle_throughput: { input: {} },

  // hk-bus
  kmb_routes: { input: { route: "1a" }, check: nonEmpty },
  kmb_stops: { input: { search: "mong kok" }, check: nonEmpty },
  kmb_stop: { input: { stopId: "18492910339410B1" } },
  kmb_route_stops: { input: { route: "1a" }, check: nonEmpty },
  kmb_stop_eta: { input: { stopId: "18492910339410B1" } },
  kmb_route_eta: { input: { route: "1a" } },
  citybus_routes: { input: { route: "a21" }, check: nonEmpty },
  citybus_stop: { input: { stopId: "001313" } },
  citybus_route_stops: { input: { route: "a21" }, check: nonEmpty },
  citybus_eta: { input: { stopId: "001313", route: "a21" } },
  nlb_routes: { input: { route: "1" }, check: nonEmpty },
  nlb_route_stops: { input: { routeId: "1" }, check: nonEmpty },
  nlb_eta: {
    input: async (call) => {
      const stops = await call("nlb_route_stops", { routeId: "1" });
      return { routeId: "1", stopId: String(first<{ stopId: string }>(stops.data, "NLB stop").stopId) };
    },
  },
  mtr_bus_schedule: { input: { routeName: "K12" } },
  gmb_routes: { input: { region: "KLN" }, check: nonEmpty },
  gmb_route: { input: { region: "KLN", route: "44M" } },
  gmb_route_stops: { input: { routeId: "2002329" } },
  gmb_stop: { input: { stopId: "20000859" } },
  gmb_stop_routes: { input: { stopId: "20000859" } },
  gmb_stop_eta: { input: { stopId: "20000859" } },
  gmb_route_stop_eta: { input: { routeId: "2002329", stopSeq: 1 } },
  tram_routes: { input: {}, check: nonEmpty },
  tram_stops: { input: {}, check: nonEmpty },

  // hk-holidays
  hk_public_holidays: { input: {}, check: nonEmpty },
  hk_is_public_holiday: { input: { date: dashed(hkDate()) } },

  // hko-weather
  hko_current_weather: { input: {} },
  hko_local_forecast: { input: {} },
  hko_nine_day_forecast: { input: {} },
  hko_warning_summary: { input: {} },
  hko_warning_details: { input: {} },
  hko_special_weather_tips: { input: {} },
  hko_earthquake: { input: {} },
  hko_lunar_date: { input: { date: dashed(hkDate()) } },

  // mtr
  mtr_next_train: { input: { line: "TML", sta: "TUM" } },
  mtr_light_rail_schedule: { input: { stationId: "100" } },

  // td-carpark
  carpark_info: { input: { search: "mong kok" }, check: nonEmpty },
  carpark_vacancy: { input: {}, check: nonEmpty },

  // epd-aqhi
  aqhi_current: { input: {}, check: nonEmpty },
  aqhi_forecast: { input: {} },
  aqhi_past_24h: { input: { station: "Central/Western" } },

  // epd-beach
  beach_water_quality: { input: {}, check: nonEmpty },

  // hk-airport
  airport_departures: { input: { date: dashed(hkDate()) }, check: nonEmpty },
  airport_arrivals: { input: { date: dashed(hkDate()) }, check: nonEmpty },

  // hk-ferry
  ferry_routes: { input: {}, check: nonEmpty },
  ferry_arrivals: { input: { route: "CECC" } },
  hkkf_timetable: { input: { route: 1 } },
  hkkf_fares: { input: { route: 1 } },

  // hko-cyclone (empty when there's no tropical cyclone)
  hko_tropical_cyclones: { input: {} },
  hko_cyclone_track: { input: {} },

  // hko-regional
  hko_rainfall_past_hour: { input: {}, check: nonEmpty },
  hko_uv_index: { input: {} },
  hko_lightning: { input: {} },
  hko_regional_weather: { input: {} },
  hko_heat_stress: { input: {} },

  // hko-tides
  hko_tide_times: { input: { station: "Quarry Bay", date: dashed(hkDate()) } },
  hko_tide_observations: { input: {} },
  hko_sun_moon: { input: { date: dashed(hkDate()) } },

  // kowloon-east-parking
  ke_carparks: { input: {}, check: nonEmpty },
  ke_parking_vacancy: { input: {}, check: nonEmpty },

  // td-street-parking
  parking_meter_vacancy: { input: {}, check: nonEmpty },
  parking_meter_spaces: { input: { street: "Lockhart" }, check: nonEmpty },
  parking_meter_nearby: { input: { latitude: 22.2784, longitude: 114.1694, radius: 200 } },
  parking_sensor_vacancy: { input: {}, check: nonEmpty },

  // td-traffic
  traffic_news: { input: {} },
  traffic_journey_times: { input: {}, check: nonEmpty },
  traffic_cameras: { input: {}, check: nonEmpty },
};
