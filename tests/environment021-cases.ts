import { readFileSync } from "node:fs";
import { services } from "@/generated/registry";
import type { ToolInput } from "@/lib/mcp/types";
export const fixture021 = (file: string) => readFileSync(new URL(`./fixtures/environment021/${file}`, import.meta.url), "utf8");
export const json021 = (file: string) => JSON.parse(fixture021(file));
export function definition021(name: string) {
  const service = services.find((s) => s.tools.some((t) => t.name === name))!;
  return { service, tool: service.tools.find((t) => t.name === name)! };
}
export const water021: { api: string; tool: string; file: string; input: ToolInput; url: string }[] = [
  {
    "api": "API-1833",
    "tool": "epd_recent_marine_water_quality",
    "file": "marine-en.csv",
    "input": {
      "lang": "en",
      "limit": 2
    },
    "url": "https://cd.epic.epd.gov.hk/marinepsi/en/marinerecent/marine-recent-en.csv"
  },
  {
    "api": "API-1833",
    "tool": "epd_recent_marine_water_quality",
    "file": "marine-tc.csv",
    "input": {
      "lang": "tc",
      "limit": 2
    },
    "url": "https://cd.epic.epd.gov.hk/marinepsi/tc/marinerecent/marine-recent-tc.csv"
  },
  {
    "api": "API-1833",
    "tool": "epd_recent_marine_water_quality",
    "file": "marine-sc.csv",
    "input": {
      "lang": "sc",
      "limit": 2
    },
    "url": "https://cd.epic.epd.gov.hk/marinepsi/sc/marinerecent/marine-recent-sc.csv"
  },
  {
    "api": "API-1838",
    "tool": "epd_recent_river_water_quality",
    "file": "river-en.csv",
    "input": {
      "lang": "en",
      "limit": 2
    },
    "url": "https://cd.epic.epd.gov.hk/riverpsi/en/riverrecent/river-recent-en.csv"
  },
  {
    "api": "API-1838",
    "tool": "epd_recent_river_water_quality",
    "file": "river-tc.csv",
    "input": {
      "lang": "tc",
      "limit": 2
    },
    "url": "https://cd.epic.epd.gov.hk/riverpsi/tc/riverrecent/river-recent-tc.csv"
  },
  {
    "api": "API-1838",
    "tool": "epd_recent_river_water_quality",
    "file": "river-sc.csv",
    "input": {
      "lang": "sc",
      "limit": 2
    },
    "url": "https://cd.epic.epd.gov.hk/riverpsi/sc/riverrecent/river-recent-sc.csv"
  },
  {
    "api": "API-1835",
    "tool": "epd_historical_river_water_quality",
    "file": "historical-en.csv",
    "input": {
      "lang": "en",
      "limit": 2,
      "year": 2025
    },
    "url": "https://cd.epic.epd.gov.hk/riverpsi/en/riverhistorical/river-historical-2025-en.csv"
  },
  {
    "api": "API-1837",
    "tool": "epd_historical_river_water_quality",
    "file": "historical-tc.csv",
    "input": {
      "lang": "tc",
      "limit": 2,
      "year": 2025
    },
    "url": "https://cd.epic.epd.gov.hk/riverpsi/tc/riverhistorical/river-historical-2025-tc.csv"
  },
  {
    "api": "API-1836",
    "tool": "epd_historical_river_water_quality",
    "file": "historical-sc.csv",
    "input": {
      "lang": "sc",
      "limit": 2,
      "year": 2025
    },
    "url": "https://cd.epic.epd.gov.hk/riverpsi/sc/riverhistorical/river-historical-2025-sc.csv"
  }
];
export const spatial021 = [
  {
    "service": "epd-recycling",
    "api": "API-1834",
    "tool": "epd_recyclable_collection_points",
    "layer": "epd_rcd_1630899452408_9505",
    "nameFields": {
      "en": "address_en",
      "tc": "address_tc",
      "sc": "address_sc"
    }
  },
  {
    "service": "epd-waste-collectors",
    "api": "API-1839",
    "tool": "epd_chemical_waste_collectors",
    "layer": "epd_rcd_1666161129768_2527",
    "nameFields": {
      "en": "Collector_Name_Eng",
      "tc": "Collector_Name_Chin"
    }
  },
  {
    "service": "epd-waste-collectors",
    "api": "API-1840",
    "tool": "epd_clinical_waste_collectors",
    "layer": "epd_rcd_1666160952535_97414",
    "nameFields": {
      "en": "Collector_Name_Eng",
      "tc": "Collector_Name_Chin"
    }
  },
  {
    "service": "epd-noise-permits",
    "api": "API-1841",
    "tool": "epd_construction_noise_permits",
    "layer": "epd_rcd_1664940858993_72368",
    "nameFields": {
      "en": "SITE_ADDRESS_ENG",
      "tc": "SITE_ADDRESS_CHIN"
    }
  },
  {
    "service": "epd-complaints",
    "api": "API-1842",
    "tool": "epd_pollution_complaint_statistics",
    "layer": "epd_rcd_1629267205235_67879",
    "nameFields": {
      "en": "DistrictEN",
      "tc": "DistrictTC"
    }
  }
];
export const environmentCases = [
  ...water021.map((c) => ({
    ...c, request: { url: c.url }, reply: fixture021(c.file), ttl: 3600,
    data: { results: expectWater(c.file), returned: 2, hasMore: true, nextOffset: 2, total: 3,
      source: c.url, language: c.input.lang, datePrecision: c.file.startsWith("historical") ? "day" : "month" },
  })),
  ...spatial021.map((c) => {
    const reply = json021(`${c.api}.json`);
    const url = `https://portal.csdi.gov.hk/server/rest/services/common/${c.layer}/FeatureServer/0/query?f=json&where=1%3D1&outFields=*&outSR=4326&returnGeometry=false&resultRecordCount=2&resultOffset=0&orderByFields=OBJECTID+ASC&geometryPrecision=6`;
    return { ...c, file: `${c.api}.json`, input: { limit: 2 } as ToolInput, request: { url }, reply, ttl: 3600,
      data: { results: reply.features.map((f: { attributes: Record<string, unknown> }) => {
        const attrs = Object.fromEntries(Object.entries(f.attributes).filter(([, v]) => v !== null));
        return { ...attrs, name: attrs[c.nameFields.en] };
      }), returned: 2, hasMore: reply.exceededTransferLimit === true, nextOffset: reply.exceededTransferLimit === true ? 2 : null,
      source: url, coordinateSystem: "WGS84 (longitude, latitude)" },
    };
  }),
];
function expectWater(file: string) {
  return [json021("expected-water.json")[file], json021("second-water.json")[file]];
}
