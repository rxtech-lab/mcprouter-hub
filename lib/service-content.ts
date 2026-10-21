import { msg } from "@/lib/i18n/translate";

/** Editorial examples describe existing capabilities; they never contain fabricated live readings. */
export const serviceContent: Record<string, { title: string; examples: string[]; limitation: string }> = {
  "hk-bus": {
    title: msg("Hong Kong Bus, Minibus & Tram Arrivals MCP"),
    examples: [msg("Find the stops for KMB route 1A, then show arrivals at Star Ferry."), msg("Find green minibus routes in Kowloon and show their stops.")],
    limitation: msg("Choose the operator, direction and stop before requesting arrivals. Predictions depend on the operator's feed and can change."),
  },
  "hko-weather": {
    title: msg("Hong Kong Weather & Warnings MCP"),
    examples: [msg("What is the Hong Kong Observatory's forecast for today?"), msg("Show the nine-day forecast and any weather warnings currently in force.")],
    limitation: msg("Weather products have different publication times. Check the observation or issue time returned by the source; a forecast is not a current observation."),
  },
  mtr: {
    title: msg("Hong Kong MTR & Light Rail Next Train MCP"),
    examples: [msg("Show the next Island Line trains at Admiralty in both directions."), msg("Find the next Light Rail trains at a stop, grouped by platform.")],
    limitation: msg("Heavy rail requests need a supported line and station code. MTR Bus arrivals belong to the bus service. Train schedules can change."),
  },
  "epd-aqhi": {
    title: msg("Hong Kong Air Quality Health Index MCP"),
    examples: [msg("Show the current AQHI and health risk at Hong Kong monitoring stations."), msg("Compare the past 24 hours of AQHI at Central with the current forecast.")],
    limitation: msg("AQHI readings are station-specific and published hourly. Use the source's timestamp and health-risk wording when presenting results."),
  },
  "censtatd-gdp": {
    title: msg("Hong Kong GDP & Consumption Statistics MCP"),
    examples: [msg("Show the latest available Hong Kong GDP and per capita GDP figures."), msg("Compare real GDP growth with the contributions of major expenditure components.")],
    limitation: msg("Statistical releases can be revised. Preserve the period, units, price basis and provisional markers; use pagination to retrieve older observations."),
  },
};
