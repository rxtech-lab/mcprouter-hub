import { readFileSync } from "node:fs";
import type { Case } from "./tool-case";

export const batch073 = [
  { api: "API-2190", service: "hkma-information-centre", tool: "hkma_information_centre", file: "2190", dataset: "hkma_rcd_1640054678975_66504" },
  { api: "API-2414", service: "hkstp-commerce", tool: "hkstp_companies", file: "2414", url: "https://opendata.hkstp.org/corporate/companydirectory/v1/" },
  { api: "API-2418", service: "hkstp-commerce", tool: "hkstp_jobs", file: "2418", url: "https://opendata.hkstp.org/corporate/recruitment/v1/" },
  { api: "API-2420", service: "hkstp-commerce", tool: "hkstp_lab_office_space", file: "2420", url: "https://opendata.hkstp.org/corporate/figures/laboffice/v1/" },
  { api: "API-2430", service: "hkpost-kiosks", tool: "ipostal_kiosks", file: "2430", dataset: "hkpo_rcd_1639016844639_48104" },
] as const;
export function fixture073(file: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/batch073/${file}.json`, import.meta.url), "utf8"));
}
export function request073(c: typeof batch073[number]) {
  if ("url" in c) return c.url;
  return `https://portal.csdi.gov.hk/server/rest/services/common/${c.dataset}/FeatureServer/0/query?f=json&where=1%3D1&outFields=*&outSR=4326&returnGeometry=true&orderByFields=OBJECTID+ASC&geometryPrecision=6&resultRecordCount=20&resultOffset=0`;
}
function expected(c: typeof batch073[number]) {
  const body = fixture073(c.file) as Record<string, unknown>;
  let results: unknown[];
  if ("dataset" in c) {
    results = (body.features as { attributes: Record<string, unknown>; geometry: unknown }[]).map((f) => ({ ...f.attributes,
      name: f.attributes[c.file === "2190" ? "NAME_EN_" : "NameEN"], geometry: f.geometry }));
    return { language: "en", coordinateSystem: "WGS84 (longitude, latitude)", results, returned: results.length, hasMore: false, nextOffset: null };
  }
  if (c.file === "2414") results = (body.value as Record<string, unknown>[]).map((r) => ({ ...r, name: r.name_EN, address: r.address_EN, introduction: r.introduction_EN, product: r.product_EN }));
  else results = c.file === "2418" ? body as unknown as unknown[] : [body];
  return { language: c.file === "2414" ? "en" : "source", ...(c.file === "2420" ? { unit: "sq ft" } : {}), total: results.length, results, returned: results.length, hasMore: false, nextOffset: null };
}
export const cases073: Case[] = batch073.map((c) => ({ tool: c.tool, input: {}, reply: fixture073(c.file), request: { url: request073(c) }, ttl: 3600, data: expected(c) }));
