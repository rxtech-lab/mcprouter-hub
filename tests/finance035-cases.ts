import { readFileSync } from "node:fs";
import { services } from "@/generated/registry";

export const batch035 = [
  { service: "cr-company-addresses", tool: "cr_company_addresses", api: "API-1313", fixture: "address-local.json", input: { value: "C1572528" } },
  { service: "cr-tcsp", tool: "cr_tcsp_licensees", api: "API-1332", fixture: "tcsp.csv", input: {} },
  { service: "customs-warehouses", tool: "customs_bonded_warehouses", api: "API-1428", fixture: "warehouse-en.csv", input: {} },
  { service: "hkma-finance", tool: "hkma_exchange_rates", api: "API-0046", fixture: "hkma_exchange_rates.json", input: {} },
  { service: "hkma-finance", tool: "hkma_hibor", api: "API-0047", fixture: "hkma_hibor.json", input: {} },
  { service: "hkma-finance", tool: "hkma_interbank_liquidity", api: "API-0048", fixture: "hkma_interbank_liquidity.json", input: {} },
  { service: "hkma-finance", tool: "hkma_securities_staff", api: "API-2153", fixture: "hkma_securities_staff.json", input: { search: "EXAMPLE" } },
  { service: "hkma-finance", tool: "hkma_money_brokers", api: "API-2154", fixture: "hkma_money_brokers.json", input: {} },
  { service: "hkma-finance", tool: "hkma_cmu_instruments", api: "API-2158", fixture: "hkma_cmu_instruments.json", input: {} },
  { service: "hkma-finance", tool: "hkma_cmu_members", api: "API-2159", fixture: "hkma_cmu_members.json", input: {} },
];
export const blocked035 = ["API-0046", "API-0048", "API-2153", "API-2159"];
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
    hkma_exchange_rates: "https://api.hkma.gov.hk/public/market-data-and-statistics/monthly-statistical-bulletin/er-ir/er-eeri-daily?pagesize=3&offset=0&sortby=end_of_day&sortorder=desc",
    hkma_hibor: "https://api.hkma.gov.hk/public/market-data-and-statistics/monthly-statistical-bulletin/er-ir/hk-interbank-ir-daily?segment=hibor.fixing&pagesize=3&offset=0&sortby=end_of_day&sortorder=desc",
    hkma_interbank_liquidity: "https://api.hkma.gov.hk/public/market-data-and-statistics/daily-monetary-statistics/daily-figures-interbank-liquidity?pagesize=3&offset=0&sortby=end_of_date&sortorder=desc",
    hkma_securities_staff: "https://api.hkma.gov.hk/public/bank-svf-info/register-ais-secstaff?pagesize=3&offset=0&is_curr_rel_indiv=0&lang=en&searchtype=engName&surname=EXAMPLE",
    hkma_money_brokers: "https://api.hkma.gov.hk/public/bank-svf-info/register-ambs?pagesize=3&offset=0&lang=en&segment=en",
    hkma_cmu_instruments: "https://api.hkma.gov.hk/public/debt-securities-settlement-system/operational-information/list-of-cmu-instruments?pagesize=3&offset=0",
    hkma_cmu_members: "https://api.hkma.gov.hk/public/debt-securities-settlement-system/operational-information/list-of-cmu-members?pagesize=3&offset=0",
  };
  return urls[tool];
}
