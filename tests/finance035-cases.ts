import { readFileSync } from "node:fs";
import { services } from "@/generated/registry";

export const batch035 = [
  { service: "cr-company-addresses", tool: "cr_company_addresses", api: "API-1313", fixture: "address-local.json", input: { value: "C1572528" } },
  { service: "cr-tcsp", tool: "cr_tcsp_licensees", api: "API-1332", fixture: "tcsp.csv", input: {} },
  { service: "customs-warehouses", tool: "customs_bonded_warehouses", api: "API-1428", fixture: "warehouse-en.csv", input: {} },
  { service: "hkma-finance", tool: "hkma_hibor", api: "API-0047", fixture: "hkma_hibor.json", input: {} },
];
export function fixture035(file: string) {
  return readFileSync(new URL(`./fixtures/finance035/${file}`, import.meta.url), "utf8");
}
export function definition035(name: string) {
  const service = services.find((candidate) => candidate.tools.some((tool) => tool.name === name))!;
  return { service, tool: service.tools.find((tool) => tool.name === name)! };
}
export function request035(tool: string) {
  const urls: Record<string, string> = {
    cr_company_addresses: "https://data.cr.gov.hk/cr/api/api/v1/api_builder/json/local/search?query%5B0%5D%5Bkey1%5D=Brn&query%5B0%5D%5Bkey2%5D=equal&query%5B0%5D%5Bkey3%5D=C1572528",
    cr_tcsp_licensees: "https://www.tcsp.cr.gov.hk/open-data/licensees.csv",
    customs_bonded_warehouses: "https://www.customs.gov.hk/filemanager/common/csv/en/list_of_warehouse_en.csv",
    hkma_hibor: "https://api.hkma.gov.hk/public/market-data-and-statistics/monthly-statistical-bulletin/er-ir/hk-interbank-ir-daily?segment=hibor.fixing&pagesize=3&offset=0&sortby=end_of_day&sortorder=desc",
  };
  return urls[tool];
}
