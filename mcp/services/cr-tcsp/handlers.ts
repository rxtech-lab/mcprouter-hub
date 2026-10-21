import type { ResponseTransformer } from "@/lib/mcp/types";
import { financeCsv, filePage } from "@/lib/mcp/finance-file";
import { malformed } from "@/lib/mcp/spatial";

export const tcspResponse: ResponseTransformer = (body, input) => {
  const source = "https://www.tcsp.cr.gov.hk/open-data/licensees.csv";
  const rows = financeCsv(body, source, ["Licence No.(牌照編號)", "Name of TCSP Licensee in English(持牌人的英文姓名／名稱)",
    "Name of TCSP Licensee in Chinese(持牌人的中文姓名／名稱)", "Business Address(營業地址)", "Remarks in English(英文備註)", "Remarks in Chinese(中文備註)"])
    .map(([licence, nameEn, nameTc, address, remarksEn, remarksTc]) => {
      if (!/^TC\d{6}$/.test(licence) || !(nameEn || nameTc)) malformed(source);
      return { licence, nameEn, nameTc, address, remarksEn, remarksTc,
        name: input.lang === "en" ? nameEn || nameTc : nameTc || nameEn,
        remarks: input.lang === "en" ? remarksEn : remarksTc };
    });
  return { ...filePage(rows, input, source), sourceLanguage: "en,tc", translation: "Original bilingual file; sc uses original Traditional Chinese values." };
};
