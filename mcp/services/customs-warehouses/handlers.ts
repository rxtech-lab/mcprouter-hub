import type { ResponseTransformer } from "@/lib/mcp/types";
import { financeCsv, filePage } from "@/lib/mcp/finance-file";
import { malformed } from "@/lib/mcp/spatial";

const headers: Record<string, string[]> = {
  en: ["Company Name", "Licence No.", "Region", "Address", "Tel No.", "Type of Warehouse"],
  tc: ["公司名稱", "牌照號碼", "地區", "地址", "電話號碼", "保稅倉類別"],
  sc: ["公司名称", "牌照号码", "地区", "地址", "电话号码", "保税仓类别"],
};
export const warehouseResponse: ResponseTransformer = (body, input) => {
  const lang = String(input.lang);
  const source = `https://www.customs.gov.hk/filemanager/common/csv/${lang}/list_of_warehouse_${lang}.csv`;
  const rows = financeCsv(body, source, headers[lang]).map(([name, licence, region, address, telephone, type]) => {
    if (!name || (licence !== "" && !/^\d+$/.test(licence)) || !address || !type) malformed(source);
    return { name, licence, region, address, telephone, type };
  });
  return filePage(rows, input, source);
};
