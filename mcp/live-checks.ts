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
const nonEmptyPage = (result: ToolResult) => {
  const rows = (result.data as { results?: unknown[] } | null)?.results;
  return Array.isArray(rows) && rows.length > 0 ? null : "Returned no dataset records";
};

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
  ...Object.fromEntries(["census_2021_major_housing_estates", "census_2021_new_towns", "census_2021_small_subunit_groups", "census_2021_small_planning_unit_groups", "census_2021_subdivided_units_districts", "population_households_by_district", "living_quarters_by_area_type", "living_quarters_by_district", "population_density_by_district", "census_2016_lsbg", "census_2016_ltpu", "census_2016_ssbg", "census_2016_stpu", "census_2016_sdu_dcd", "census_2021_dcca", "census_2021_dcd", "census_2021_lsg", "census_2021_ltpu"].map((name) => [name, { input: { limit: 1 }, check: nonEmptyPage }])),
  ...Object.fromEntries(["2006_ssbg", "2006_stpu", "2011_dcca", "2011_dcd", "2011_lsbg", "2011_ltpu", "2011_ssbg", "2011_stpu", "2016_dcca", "2016_dcd"].map((name) => [`census_${name}`, { input: { limit: 1 }, check: nonEmptyPage }])),
  ...Object.fromEntries(["old_survey_sheets_1", "old_survey_sheets_2", "old_survey_sheets_3", "old_survey_sheets_4", "old_survey_sheets_5", "private_treaty_grants", "public_facilities", "public_open_space", "road_centrelines", "short_term_tenancies"].map((name) => [`landsd_${name}`, { input: { limit: 1 }, check: nonEmptyPage }])),
  landsd_satref_nmea_snapshot: { input: {}, check: nonEmptyPage },
  landsd_satref_rinex_header: { input: async () => { const date = new Date(Date.now() - 2 * 86400000); const year = date.getUTCFullYear(); return { year, day: Math.floor((Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - Date.UTC(year, 0, 0)) / 86400000) }; } },
  // Batch085 official CSDI records and the documented LandsD PNG tile.
  landsd_land_acquisition_notices: { input: { limit: 1 }, check: nonEmptyPage },
  landsd_executed_land_exchanges: { input: { limit: 1 }, check: nonEmptyPage },
  landsd_executed_lease_extensions: { input: { limit: 1 }, check: nonEmptyPage },
  landsd_executed_lease_modifications: { input: { limit: 1 }, check: nonEmptyPage },
  landsd_land_sale_records: { input: { limit: 1 }, check: nonEmptyPage },
  landsd_industrial_2009_land_exchanges: { input: { limit: 1 }, check: nonEmptyPage },
  landsd_industrial_2009_lease_modifications: { input: { limit: 1 }, check: nonEmptyPage },
  landsd_industrial_2018_lease_modifications: { input: { limit: 1 }, check: nonEmptyPage },
  landsd_industrial_2009_special_waivers: { input: { limit: 1 }, check: nonEmptyPage },
  landsd_topographic_tile: {
    input: { sr: "HK80", z: 11, x: 287, y: 385 },
    check: (result) => {
      const tile = result.data as { available?: boolean; width?: number; height?: number };
      return tile.available === true && tile.width === 256 && tile.height === 256 ? null : "Expected a validated 256-pixel LandsD PNG tile";
    },
  },

  // Batch079: verified GPA and HAD feature layers; indoor archive remains blocked.
  gpa_domestic_properties_for_sale: { input: { limit: 1 }, check: nonEmptyPage },
  gpa_government_office_open_spaces: { input: { limit: 1 }, check: nonEmptyPage },
  gpa_ngo_accommodation: { input: { limit: 1 }, check: nonEmptyPage },
  had_village_boundaries_2019_2022: { input: { limit: 1 }, check: nonEmptyPage },
  had_village_boundaries_2023_2026: { input: { limit: 1 }, check: nonEmptyPage },
  had_village_boundaries_2027_2030: { input: { limit: 1 }, check: nonEmptyPage },
  had_historical_district_boundaries: { input: { limit: 1 }, check: nonEmptyPage },
  had_district_boundaries: { input: { limit: 1 }, check: nonEmptyPage },
  had_permitted_burial_boundaries: { input: { limit: 1 }, check: nonEmptyPage },

  list_top_news: {
    input: { x: 1 },
    check: (result) => {
      const data = result.data as { partial?: boolean; providers?: { status: string; returned: number }[] };
      return data.partial === false && data.providers?.length === 3 && data.providers.every((p) => p.status === "ok" && p.returned > 0)
        ? null : "Expected non-empty headlines from all three news providers";
    },
  },
  get_news_detail: {
    input: async (call) => {
      const result = await call("list_top_news", { x: 1 });
      const news = (result.data as { news?: { id: string }[] }).news;
      return { id: first<{ id: string }>(news, "news article").id };
    },
  },
  scrape_website: {
    input: { url: "https://example.com/" },
    check: (result) => typeof (result.data as { markdown?: unknown }).markdown === "string" &&
      (result.data as { markdown: string }).markdown.trim() ? null : "Expected scraped Markdown",
  },
  search_news: {
    input: { query: "technology news", limit: 1 },
    check: (result) => Array.isArray((result.data as { news?: unknown }).news) ? null : "Expected a news result list",
  },
  // Batch073: only the five sources with usable current bodies.
  hkma_information_centre: { input: { limit: 1 }, check: nonEmptyPage },
  hkstp_companies: { input: { limit: 1 }, check: nonEmptyPage },
  hkstp_jobs: { input: { limit: 1 }, check: nonEmptyPage },
  hkstp_lab_office_space: { input: { limit: 1 }, check: nonEmptyPage },
  ipostal_kiosks: { input: { limit: 1 }, check: nonEmptyPage },

  // Batch066: verified business and energy tables.
  service_business_receipts_indices: { input: { limit: 1 }, check: nonEmptyPage },
  service_business_receipts_yoy: { input: { limit: 1 }, check: nonEmptyPage },
  seasonally_adjusted_business_receipts: { input: { limit: 1 }, check: nonEmptyPage },
  business_receipts_quarterly_change: { input: { limit: 1 }, check: nonEmptyPage },
  industry_concentration_ratios: { input: { limit: 1 }, check: nonEmptyPage },
  enterprise_operating_characteristics: { input: { limit: 1 }, check: nonEmptyPage },
  enterprise_operating_characteristics_historical: { input: { limit: 1 }, check: nonEmptyPage },
  overall_energy_balance: { input: { limit: 1 }, check: nonEmptyPage },
  energy_import_unit_values: { input: { limit: 1 }, check: nonEmptyPage },
  monthly_energy_net_imports: { input: { limit: 1 }, check: nonEmptyPage },
  oil_storage_and_stocks: { input: { limit: 1 }, check: nonEmptyPage },
  oil_sales_by_user: { input: { limit: 1 }, check: nonEmptyPage },
  oil_imports_by_supplier: { input: { limit: 1 }, check: nonEmptyPage },
  coal_imports_by_supplier: { input: { limit: 1 }, check: nonEmptyPage },
  oil_reexports_by_destination: { input: { limit: 1 }, check: nonEmptyPage },
  coal_reexports_by_destination: { input: { limit: 1 }, check: nonEmptyPage },
  monthly_electricity_gas_consumption: { input: { limit: 1 }, check: nonEmptyPage },
  electricity_gas_consumption_revenue: { input: { limit: 1 }, check: nonEmptyPage },
  energy_net_import_values: { input: { limit: 1 }, check: nonEmptyPage },
  energy_net_import_quantities: { input: { limit: 1 }, check: nonEmptyPage },

  // Batch060: construction, real estate and architectural business statistics.
  architecture_selected_statistics: { input: { limit: 1 }, check: nonEmptyPage },
  real_estate_selected_statistics: { input: { limit: 1 }, check: nonEmptyPage },
  construction_business_by_industry: { input: { limit: 1 }, check: nonEmptyPage },
  construction_business_by_output: { input: { limit: 1 }, check: nonEmptyPage },
  construction_business_by_value_added: { input: { limit: 1 }, check: nonEmptyPage },
  main_contractors_business_statistics: { input: { limit: 1 }, check: nonEmptyPage },
  real_estate_business_by_industry: { input: { limit: 1 }, check: nonEmptyPage },
  real_estate_business_by_receipts: { input: { limit: 1 }, check: nonEmptyPage },
  architecture_principal_statistics: { input: { limit: 1 }, check: nonEmptyPage },
  architecture_business_by_receipts: { input: { limit: 1 }, check: nonEmptyPage },

  sme_diffusion_indices: { input: { limit: 2 }, check: nonEmptyPage },
  sme_credit_needs: { input: { limit: 2 }, check: nonEmptyPage },
  business_expected_situation: { input: { limit: 2 }, check: nonEmptyPage },
  business_expected_output: { input: { limit: 2 }, check: nonEmptyPage },
  business_expected_employment: { input: { limit: 2 }, check: nonEmptyPage },
  business_expected_prices: { input: { limit: 2 }, check: nonEmptyPage },
  business_orders_stocks_levels: { input: { limit: 2 }, check: nonEmptyPage },
  business_profit_situation: { input: { limit: 2 }, check: nonEmptyPage },
  business_financial_situation: { input: { limit: 2 }, check: nonEmptyPage },
  business_credit_access: { input: { limit: 2 }, check: nonEmptyPage },

  hktr_interest_rate_positions: { input: { limit: 2 }, check: nonEmptyPage },
  hktr_members_lei: { input: { limit: 2 }, check: nonEmptyPage },
  ird_offices: { input: { limit: 2 }, check: nonEmptyPage },
  hk_address_lookup: { input: { limit: 2, q: "central government offices" }, check: nonEmptyPage },
  lcsd_swimming_pools: { input: { limit: 2 }, check: nonEmptyPage },
  hk_government_press_releases: { input: { limit: 2 }, check: nonEmptyPage },
  regional_office_counts: { input: { limit: 2 }, check: nonEmptyPage },
  regional_office_employment: { input: { limit: 2 }, check: nonEmptyPage },
  regional_offices_parent_location: { input: { limit: 2 }, check: nonEmptyPage },
  // Health batch 027: published directories and structured downloads
  health_dhc_express: { input: { limit: 2 }, check: nonEmptyPage },
  health_women_wellness_satellites: { input: { limit: 2 }, check: nonEmptyPage },
  ha_specialist_waiting_times: { input: { limit: 2 }, check: nonEmptyPage },
  ha_chinese_medicine_centres: { input: { limit: 2 }, check: nonEmptyPage },
  ha_healthcare_facilities: { input: { limit: 2 }, check: nonEmptyPage },
  ha_ambulatory_community_throughput: { input: { limit: 2 }, check: nonEmptyPage },
  ha_chinese_medicine_throughput: { input: { limit: 2 }, check: nonEmptyPage },
  ha_inpatient_throughput: { input: { limit: 2 }, check: nonEmptyPage },

  // Health batch 025: verified subset
  health_hiv_aids_by_sex: { input: { limit: 2 }, check: nonEmptyPage },
  health_school_immunisation: { input: { limit: 2 }, check: nonEmptyPage },
  health_accident_emergency: { input: { limit: 2 }, check: nonEmptyPage },
  health_chinese_medicine_clinics: { input: { limit: 2 }, check: nonEmptyPage },
  health_flu_express: { input: { limit: 2 }, check: nonEmptyPage },

  pland_site_wind_grids: { input: { limit: 2 }, check: nonEmptyPage },
  afcd_boarding_establishments: { input: { limit: 2 }, check: nonEmptyPage },
  afcd_pesticide_licensees: { input: { limit: 2 }, check: nonEmptyPage },
  health_notifiable_diseases: { input: { limit: 2 }, check: nonEmptyPage },
  health_notifiable_disease_deaths: { input: { limit: 2 }, check: nonEmptyPage },
  health_registered_professionals: { input: { limit: 2 }, check: nonEmptyPage },
  health_hospital_institutions_beds: { input: { limit: 2 }, check: nonEmptyPage },
  health_public_expenditure: { input: { limit: 2 }, check: nonEmptyPage },
  towngas_environment_performance: { input: { limit: 2 }, check: nonEmptyPage },
  pland_site_wind_profile: { input: { objectId: 1, limit: 2 }, check: nonEmptyPage },
  // Environment batch 023
  epd_recycling_stations: { input: { limit: 2 }, check: nonEmptyPage },
  fehd_exhibition_resource_centres: { input: { limit: 2 }, check: nonEmptyPage },
  fehd_refuse_camera_blackspots: { input: { limit: 2 }, check: nonEmptyPage },
  fehd_water_dispensers: { input: { limit: 2 }, check: nonEmptyPage },
  had_clothes_recycling_banks: { input: { limit: 2 }, check: nonEmptyPage },
  hko_daily_weather_radiation: { input: { limit: 2 }, check: nonEmptyPage },
  hko_hourly_gamma_radiation: { input: { limit: 2 }, check: nonEmptyPage },

  // Environment batch 022: verified subset only
  epd_collector_recycler_directory: { input: { limit: 2 }, check: nonEmptyPage },
  epd_direct_environmental_permit_applications: { input: { limit: 2 }, check: nonEmptyPage },
  epd_eia_report_applications: { input: { limit: 2 }, check: nonEmptyPage },
  epd_eia_habitat_maps: { input: { limit: 2 }, check: nonEmptyPage },
  epd_food_waste_treatment_suppliers: { input: { limit: 2 }, check: nonEmptyPage },
  epd_water_pollution_load_inventory: { input: { limit: 2 }, check: nonEmptyPage },
  // Environment batch 021
  epd_recent_marine_water_quality: { input: { limit: 2 }, check: nonEmptyPage },
  epd_recent_river_water_quality: { input: { limit: 2 }, check: nonEmptyPage },
  epd_historical_river_water_quality: { input: { limit: 2, year: 2025 }, check: nonEmptyPage },
  epd_recyclable_collection_points: { input: { limit: 2 }, check: nonEmptyPage },
  epd_chemical_waste_collectors: { input: { limit: 2 }, check: nonEmptyPage },
  epd_clinical_waste_collectors: { input: { limit: 2 }, check: nonEmptyPage },
  epd_construction_noise_permits: { input: { limit: 2 }, check: nonEmptyPage },
  epd_pollution_complaint_statistics: { input: { limit: 2 }, check: nonEmptyPage },
  cr_company_addresses: { input: { value: "C1572528" }, check: nonEmptyPage },
  cr_tcsp_licensees: { input: {}, check: nonEmptyPage },
  customs_bonded_warehouses: { input: {}, check: nonEmptyPage },
  hkma_hibor: { input: {}, check: nonEmptyPage },
  bus: { input: { action: "kmb_routes", route: "1A" }, check: nonEmpty },
  // Transport batch 003: object results contain a bounded results array.
  cad_paragliding_areas: { input: { limit: 2 }, check: nonEmptyPage },
  cedd_public_piers: { input: { limit: 2 }, check: nonEmptyPage },
  epd_public_ev_chargers: { input: { limit: 2 }, check: nonEmptyPage },
  hyd_barrier_fences: { input: { limit: 2 }, check: nonEmptyPage },
  gpa_public_carparks: { input: { limit: 2 }, check: nonEmptyPage },
  dpo_bus_stop_routes: { input: { operator: "CTB", stopId: "001001" }, check: nonEmptyPage },
  dpo_bus_stop_eta: { input: { operator: "NLB", stopId: "1" }, check: nonEmptyPage },
  // censtatd-shipping
  shipping_port_cargo_throughput: { input: {}, check: nonEmpty },
  shipping_seaborne_cargo_throughput: { input: {}, check: nonEmpty },
  shipping_seaborne_cargo_monthly: { input: {}, check: nonEmpty },
  shipping_river_cargo_throughput: { input: {}, check: nonEmpty },
  shipping_river_cargo_monthly: { input: {}, check: nonEmpty },
  shipping_port_cargo_seasonally_adjusted: { input: {}, check: nonEmpty },
  shipping_port_cargo_gba_city: { input: {}, check: nonEmpty },
  shipping_container_throughput: { input: {}, check: nonEmpty },
  shipping_laden_container_throughput: { input: {}, check: nonEmpty },
  shipping_laden_container_seasonally_adjusted: { input: {}, check: nonEmpty },
  shipping_laden_container_gba_city: { input: {}, check: nonEmpty },
  shipping_container_handling_location: { input: {}, check: nonEmpty },

  // censtatd-transport
  air_cargo_movements: { input: {}, check: nonEmpty },
  postal_services_statistics: { input: {}, check: nonEmpty },
  air_transport_capacity: { input: {}, check: nonEmpty },
  seafarers_statistics: { input: {}, check: nonEmpty },
  airport_arrival_transit_passengers: { input: {}, check: nonEmpty },

  // Finance batch 028: latest observations without tying checks to a fixed year.
  gdp_real_growth: { input: { limit: 1 }, check: nonEmptyPage },
  gdp_and_per_capita: { input: { limit: 1 }, check: nonEmptyPage },
  gdp_expenditure_current: { input: { limit: 1 }, check: nonEmptyPage },
  gdp_expenditure_chained: { input: { limit: 1 }, check: nonEmptyPage },
  gdp_growth_contributions: { input: { limit: 1 }, check: nonEmptyPage },
  gdp_implicit_deflators: { input: { limit: 1 }, check: nonEmptyPage },
  gdp_expenditure_ratios: { input: { limit: 1 }, check: nonEmptyPage },
  gdp_seasonally_adjusted: { input: { limit: 1 }, check: nonEmptyPage },
  pce_components_current: { input: { limit: 1 }, check: nonEmptyPage },
  pce_components_chained: { input: { limit: 1 }, check: nonEmptyPage },

  // Finance batch 030: period-free checks.
  services_trade_components_chained: { input: { limit: 1 }, check: nonEmptyPage },
  gdp_activity_current: { input: { limit: 1 }, check: nonEmptyPage },
  gdp_production_current: { input: { limit: 1 }, check: nonEmptyPage },
  activity_output_factor_income: { input: { limit: 1 }, check: nonEmptyPage },
  production_account: { input: { limit: 1 }, check: nonEmptyPage },
  generation_of_income_account: { input: { limit: 1 }, check: nonEmptyPage },
  national_accounts_aggregates: { input: { limit: 1 }, check: nonEmptyPage },
  gdp_activity_chained: { input: { limit: 1 }, check: nonEmptyPage },
  real_gross_domestic_income: { input: { limit: 1 }, check: nonEmptyPage },
  gni_and_per_capita: { input: { limit: 1 }, check: nonEmptyPage },

  // Finance batch 034: period-free checks.
  government_quarterly_revenue_expenditure: { input: { limit: 1 }, check: nonEmptyPage },
  government_revenue_funds: { input: { limit: 1 }, check: nonEmptyPage },
  government_expenditure_funds: { input: { limit: 1 }, check: nonEmptyPage },
  silver_trading_prices: { input: { limit: 1 }, check: nonEmptyPage },
  interbank_market: { input: { limit: 1 }, check: nonEmptyPage },
  exchange_fund_bills_notes_turnover: { input: { limit: 1 }, check: nonEmptyPage },
  hkex_securities_statistics: { input: { limit: 1 }, check: nonEmptyPage },
  hkex_derivatives_volume: { input: { limit: 1 }, check: nonEmptyPage },
  stock_connect_trading_values: { input: { limit: 1 }, check: nonEmptyPage },
  gold_exchange_turnover: { input: { limit: 1 }, check: nonEmptyPage },

  // Finance batch 033: period-free checks.
  mainland_outward_di_regions: { input: { limit: 1 }, check: nonEmptyPage },
  mainland_outward_di_activities: { input: { limit: 1 }, check: nonEmptyPage },
  currency_in_circulation: { input: { limit: 1 }, check: nonEmptyPage },
  money_supply_all_currencies: { input: { limit: 1 }, check: nonEmptyPage },
  money_supply_currency: { input: { limit: 1 }, check: nonEmptyPage },
  hkd_interest_rates: { input: { limit: 1 }, check: nonEmptyPage },
  hkd_interest_settlement_rates: { input: { limit: 1 }, check: nonEmptyPage },
  exchange_rates: { input: { limit: 1 }, check: nonEmptyPage },
  hkd_effective_exchange_indices: { input: { limit: 1 }, check: nonEmptyPage },
  government_revenue_expenditure: { input: { limit: 1 }, check: nonEmptyPage },
  // Finance batch 032: period-free checks.
  net_investment_flows_sector: { input: { limit: 1 }, check: nonEmptyPage },
  international_investment_position: { input: { limit: 1 }, check: nonEmptyPage },
  iip_gdp_ratios: { input: { limit: 1 }, check: nonEmptyPage },
  iip_currency_composition: { input: { limit: 1 }, check: nonEmptyPage },
  external_debt: { input: { limit: 1 }, check: nonEmptyPage },
  direct_investment_statistics: { input: { limit: 1 }, check: nonEmptyPage },
  inward_direct_investment_countries: { input: { limit: 1 }, check: nonEmptyPage },
  inward_direct_investment_activities: { input: { limit: 1 }, check: nonEmptyPage },
  outward_direct_investment_countries: { input: { limit: 1 }, check: nonEmptyPage },
  outward_direct_investment_activities: { input: { limit: 1 }, check: nonEmptyPage },

  // Finance batch 031: period-free checks.
  epif_income_components: { input: { limit: 1 }, check: nonEmptyPage },
  epif_countries: { input: { limit: 1 }, check: nonEmptyPage },
  epif_real: { input: { limit: 1 }, check: nonEmptyPage },
  gross_national_disposable_income: { input: { limit: 1 }, check: nonEmptyPage },
  rest_of_world_account: { input: { limit: 1 }, check: nonEmptyPage },
  balance_of_payments: { input: { limit: 1 }, check: nonEmptyPage },
  bop_gdp_ratios: { input: { limit: 1 }, check: nonEmptyPage },
  bop_current_capital_account: { input: { limit: 1 }, check: nonEmptyPage },
  bop_financial_account: { input: { limit: 1 }, check: nonEmptyPage },
  current_account_seasonal_changes: { input: { limit: 1 }, check: nonEmptyPage },

  // Finance batch 029: period-free checks.
  cxdm_groups_current: { input: { limit: 1 }, check: nonEmptyPage },
  cxdm_groups_chained: { input: { limit: 1 }, check: nonEmptyPage },
  cxdm_groups_distribution: { input: { limit: 1 }, check: nonEmptyPage },
  gce_components_current: { input: { limit: 1 }, check: nonEmptyPage },
  gce_components_chained: { input: { limit: 1 }, check: nonEmptyPage },
  gce_functions_current: { input: { limit: 1 }, check: nonEmptyPage },
  individual_collective_consumption: { input: { limit: 1 }, check: nonEmptyPage },
  gdfcf_components_current: { input: { limit: 1 }, check: nonEmptyPage },
  gdfcf_components_chained: { input: { limit: 1 }, check: nonEmptyPage },
  services_trade_components_current: { input: { limit: 1 }, check: nonEmptyPage },

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

  // hk-taxi-fleet
  amigo_taxi_fleet: { input: {}, check: nonEmpty },
  big_boss_taxi_fleet: { input: {}, check: nonEmpty },

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

  // Batch059: verified construction output and annual industry statistics.
  construction_output: { input: { limit: 1 }, check: nonEmptyPage },
  construction_output_seasonally_adjusted: { input: { limit: 1 }, check: nonEmptyPage },
  construction_nominal_by_trade: { input: { limit: 1 }, check: nonEmptyPage },
  construction_real_by_trade: { input: { limit: 1 }, check: nonEmptyPage },
  construction_nominal_broad_end_use: { input: { limit: 1 }, check: nonEmptyPage },
  construction_real_broad_end_use: { input: { limit: 1 }, check: nonEmptyPage },
  construction_nominal_detailed_end_use: { input: { limit: 1 }, check: nonEmptyPage },
  construction_real_detailed_end_use: { input: { limit: 1 }, check: nonEmptyPage },
  construction_nominal_by_activity: { input: { limit: 1 }, check: nonEmptyPage },
  construction_industry_statistics: { input: { limit: 1 }, check: nonEmptyPage },
  // Batch058: verified manufacturing, mining and construction indices.
  manufacturing_by_value_added: { input: { limit: 1 }, check: nonEmptyPage },
  manufacturing_by_receipts: { input: { limit: 1 }, check: nonEmptyPage },
  manufacturing_by_employment: { input: { limit: 1 }, check: nonEmptyPage },
  manufacturing_detailed_industry: { input: { limit: 1 }, check: nonEmptyPage },
  manufacturing_related_companies: { input: { limit: 1 }, check: nonEmptyPage },
  mining_quarry_production: { input: { limit: 1 }, check: nonEmptyPage },
  construction_labour_2021: { input: { limit: 1 }, check: nonEmptyPage },
  construction_labour_2003: { input: { limit: 1 }, check: nonEmptyPage },
  construction_materials_2021: { input: { limit: 1 }, check: nonEmptyPage },
  construction_materials_2003: { input: { limit: 1 }, check: nonEmptyPage },

  // td-traffic
  traffic_news: { input: {} },
  traffic_journey_times: { input: {}, check: nonEmpty },
  traffic_cameras: { input: {}, check: nonEmpty },
  // Batch061: verified retail sales, business performance and restaurant tables.
  retail_sales_total: { input: { limit: 1 }, check: nonEmptyPage },
  retail_sales_value_by_outlet: { input: { limit: 1 }, check: nonEmptyPage },
  retail_sales_volume_by_outlet: { input: { limit: 1 }, check: nonEmptyPage },
  supermarket_sales_by_product: { input: { limit: 1 }, check: nonEmptyPage },
  department_store_sales_by_product: { input: { limit: 1 }, check: nonEmptyPage },
  retail_sales_seasonally_adjusted: { input: { limit: 1 }, check: nonEmptyPage },
  online_retail_sales: { input: { limit: 1 }, check: nonEmptyPage },
  supermarket_business_statistics: { input: { limit: 1 }, check: nonEmptyPage },
  department_store_business_statistics: { input: { limit: 1 }, check: nonEmptyPage },
  restaurant_receipts_purchases: { input: { limit: 1 }, check: nonEmptyPage },

  // Batch062: verified restaurant and industry business statistics.
  restaurant_receipts_purchases_monthly: { input: { limit: 1 }, check: nonEmptyPage },
  restaurant_receipts_by_type: { input: { limit: 1 }, check: nonEmptyPage },
  restaurant_receipts_by_type_monthly: { input: { limit: 1 }, check: nonEmptyPage },
  restaurant_receipts_seasonally_adjusted: { input: { limit: 1 }, check: nonEmptyPage },
  accommodation_food_business_statistics: { input: { limit: 1 }, check: nonEmptyPage },
  accommodation_food_statistics_by_employment: { input: { limit: 1 }, check: nonEmptyPage },
  accommodation_food_statistics_by_receipts: { input: { limit: 1 }, check: nonEmptyPage },
  accommodation_food_statistics_by_value_added: { input: { limit: 1 }, check: nonEmptyPage },
  trades_business_statistics: { input: { limit: 1 }, check: nonEmptyPage },
  trades_statistics_by_employment: { input: { limit: 1 }, check: nonEmptyPage },

  // Batch064: verified information, financial and business performance tables.
  information_communications_by_receipts: { input: { limit: 1 }, check: nonEmptyPage },
  information_communications_by_value_added: { input: { limit: 1 }, check: nonEmptyPage },
  financial_professional_business_statistics: { input: { limit: 1 }, check: nonEmptyPage },
  professional_business_by_employment: { input: { limit: 1 }, check: nonEmptyPage },
  professional_business_by_receipts: { input: { limit: 1 }, check: nonEmptyPage },
  professional_business_by_value_added: { input: { limit: 1 }, check: nonEmptyPage },
  banking_statistics_by_employment: { input: { limit: 1 }, check: nonEmptyPage },
  domestic_banking_by_receipts: { input: { limit: 1 }, check: nonEmptyPage },
  domestic_banking_detailed_statistics: { input: { limit: 1 }, check: nonEmptyPage },
  insurance_detailed_statistics: { input: { limit: 1 }, check: nonEmptyPage },

  // Batch063: verified commerce, transport, logistics and communications tables.
  trades_statistics_by_receipts: { input: { limit: 1 }, check: nonEmptyPage },
  trades_statistics_by_value_added: { input: { limit: 1 }, check: nonEmptyPage },
  transport_business_statistics: { input: { limit: 1 }, check: nonEmptyPage },
  transport_statistics_by_employment: { input: { limit: 1 }, check: nonEmptyPage },
  transport_statistics_by_receipts: { input: { limit: 1 }, check: nonEmptyPage },
  transport_statistics_by_value_added: { input: { limit: 1 }, check: nonEmptyPage },
  transport_detailed_industry_statistics: { input: { limit: 1 }, check: nonEmptyPage },
  logistics_business_statistics: { input: { limit: 1 }, check: nonEmptyPage },
  information_communications_business_statistics: { input: { limit: 1 }, check: nonEmptyPage },
  information_communications_by_employment: { input: { limit: 1 }, check: nonEmptyPage },
};
