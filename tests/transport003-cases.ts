import { readFileSync } from "node:fs";
import type { ToolInput } from "@/lib/mcp/types";

export const fixture = (name: string) => readFileSync(new URL(`./fixtures/transport003/${name}`, import.meta.url), "utf8");
export const jsonFixture = (name: string) => JSON.parse(fixture(name));

export const spatialCases = [
  ["cad_paragliding_areas", "cad", "cad_rcd_1697012233561_39672", "Paragliding_Area_EN"],
  ["cedd_public_piers", "cedd", "cedd_rcd_1696844622988_9055", ""],
  ["epd_public_ev_chargers", "epd", "epd_rcd_1631080339740_69941", "LOCATION_EN"],
  ["hyd_barrier_fences", "hyd", "hyd_rcd_1632210391486_52565", ""],
];

type Case = { tool: string; input: ToolInput; request: { url: string }; reply: unknown; data: unknown; ttl: number };

export const transportCases: Case[] = spatialCases.map(([tool, file, dataset, nameField]) => {
  const reply = jsonFixture(`${file}.json`);
  const query = "f=json&where=1%3D1&outFields=*&outSR=4326&returnGeometry=true&resultRecordCount=2&resultOffset=0&orderByFields=OBJECTID+ASC&geometryPrecision=6";
  const url = `https://portal.csdi.gov.hk/server/rest/services/common/${dataset}/FeatureServer/0/query?${query}`;
  return {
    tool, input: { limit: 2 }, request: { url }, reply, ttl: 86400,
    data: {
      results: reply.features.map((feature: { attributes: Record<string, unknown>; geometry: unknown }) => ({
        ...Object.fromEntries(Object.entries(feature.attributes).filter(([, value]) => value !== null)),
        ...(nameField ? { name: feature.attributes[nameField] } : {}), geometry: feature.geometry,
      })),
      returned: 2, hasMore: true, nextOffset: 2, source: url, coordinateSystem: "WGS84 (longitude, latitude)",
    },
  };
});

for (const suffix of ["routes", "eta"]) {
  const reply = jsonFixture(`bus-${suffix}.json`);
  transportCases.push({
    tool: `dpo_bus_stop_${suffix}`, input: { operator: suffix === "routes" ? "CTB" : "NLB", stopId: suffix === "routes" ? "001001" : "1" },
    request: { url: suffix === "routes" ? "https://rt.data.gov.hk/v1.1/transport/batch/stop-route/CTB/001001?lang=en" : "https://rt.data.gov.hk/v1/transport/batch/stop-eta/NLB/1?lang=en" },
    reply, ttl: suffix === "routes" ? 3600 : 30,
    data: { results: reply.data, returned: 2, hasMore: false, nextOffset: null, total: 2, generatedAt: reply.generated_timestamp },
  });
}

transportCases.push({
  tool: "border_vehicle_throughput", input: { year: 2016 },
  request: { url: "https://www.customs.gov.hk/hcms/filemanager/common/csv/statistics/passenger_land_en.csv" },
  reply: fixture("customs.csv"), ttl: 86400,
  data: [{ controlPoint: "All control points", year: 2016, quarter: 1, total: 3570.205, goodsVehicles: 1529.6, passengerVehicles: null, privateCars: null }],
});

transportCases.push({
  tool: "gpa_public_carparks", input: { search: "no-match" },
  request: { url: "https://www.gpa.gov.hk/doc/psi/ds/psi-t-cp_ENG.csv" },
  reply: fixture("gpa-en.csv"), ttl: 86400,
  data: { results: [], returned: 0, hasMore: false, nextOffset: null, total: 0, source: "https://www.gpa.gov.hk/doc/psi/ds/psi-t-cp_ENG.csv", language: "en" },
});
