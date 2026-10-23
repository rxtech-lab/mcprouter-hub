import { readFileSync } from "node:fs";
import { expect } from "vitest";
import { services } from "@/generated/registry";

export const batch051 = [
  { api: "API-2336", tool: "hktr_interest_rate_positions", file: "2336.json", input: {} },
  { api: "API-2337", tool: "hktr_members_lei", file: "2337.json", input: {} },
  { api: "API-2598", tool: "ird_offices", file: "2598.json", input: {} },
  { api: "API-0049", tool: "hk_address_lookup", file: "0049.json", input: { q: "central government offices" } },
  { api: "API-0051", tool: "lcsd_swimming_pools", file: "0051.json", input: {} },
  { api: "API-0052", tool: "hk_government_press_releases", file: "0052-en.xml", input: {} },
  { api: "API-0573", tool: "regional_office_counts", file: "0573-en.json", input: {} },
  { api: "API-0574", tool: "regional_office_employment", file: "0574-en.json", input: {} },
  { api: "API-0575", tool: "regional_offices_parent_location", file: "0575-en.json", input: {} },
];
export function fixture051(file: string) {
  return readFileSync(new URL(`./fixtures/batch051/${file}`, import.meta.url), "utf8");
}
export function definition051(name: string) {
  const service = services.find((s) => s.tools.some((t) => t.name === name))!;
  return { service, tool: service.tools.find((t) => t.name === name)! };
}
const spatialUrl = (id: string) => `https://portal.csdi.gov.hk/server/rest/services/common/${id}/FeatureServer/0/query?f=json&where=1%3D1&outFields=*&outSR=4326&returnGeometry=true&resultRecordCount=3&resultOffset=0&orderByFields=OBJECTID+ASC&geometryPrecision=6`;
const urls: Record<string, string> = {
  hktr_interest_rate_positions: "https://api.hkma.gov.hk/public/financial-market-infra/trade-repository/hktr-data-disclose-ir?segment=positions&sortby=end_of_date&sortorder=desc&pagesize=3&offset=0",
  hktr_members_lei: "https://api.hkma.gov.hk/public/financial-market-infra/trade-repository/list-of-tr-member-with-lei?sortby=tr_code&sortorder=asc&pagesize=3&offset=0",
  hk_address_lookup: "https://www.als.gov.hk/lookup?q=central+government+offices",
  hk_government_press_releases: "https://www.info.gov.hk/gia/rss/general_en.xml",
  ird_offices: spatialUrl("ird_rcd_1668166144542_67785"),
  lcsd_swimming_pools: spatialUrl("lcsd_rcd_1634540558875_77434"),
  regional_office_counts: "https://www.censtatd.gov.hk/api/get.php?id=325-43001&full_series=1&lang=en",
  regional_office_employment: "https://www.censtatd.gov.hk/api/get.php?id=325-43002&full_series=1&lang=en",
  regional_offices_parent_location: "https://www.censtatd.gov.hk/api/get.php?id=325-43011&full_series=1&lang=en",
};
export const cases051 = batch051.map((c) => ({
  tool: c.tool, input: { ...c.input, limit: 3 }, request: { url: urls[c.tool] }, reply: fixture051(c.file),
  ttl: c.api === "API-0052" ? 300 : 3600,
  data: expect.objectContaining({ returned: c.api === "API-0049" ? 1 : 3,
    results: expect.any(Array), hasMore: c.api !== "API-0049" && c.api !== "API-0052" }),
}));
