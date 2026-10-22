import { expect } from "vitest";
import type { Case } from "./tool-case";
import { readFileSync } from "node:fs";
import { services } from "@/generated/registry";
import { contracts } from "@/mcp/services/censtatd-health/contract";
import manifest from "./fixtures/environment024/manifest.json";
import type { ToolInput } from "@/lib/mcp/types";
export const entries024 = manifest;
export const fixture024 = (file: string) => readFileSync(new URL(`./fixtures/environment024/${file}`, import.meta.url), "utf8");
export function definition024(name: string) {
  const service = services.find((s) => s.tools.some((t) => t.name === name))!;
  return { service, tool: service.tools.find((t) => t.name === name)! };
}
export const cases024 = manifest.flatMap((e) => (e.languages.length ? e.languages : ["en"]).map((lang) => {
  const input: ToolInput = { limit: 3, ...(e.languages.length ? { lang } : {}) };
  const file = e.kind === "spatial" ? `${e.id}.json` : e.kind === "census" ? `${e.table}-${lang}.json` : "towngas.json";
  const reply = JSON.parse(fixture024(file));
  const url = e.kind === "spatial" ? `https://portal.csdi.gov.hk/server/rest/services/common/${e.layer}/FeatureServer/0/query?f=json&where=1%3D1&outFields=*&outSR=4326&returnGeometry=false&resultRecordCount=3&resultOffset=0&orderByFields=OBJECTID+ASC&geometryPrecision=6` :
    e.kind === "census" ? `https://www.censtatd.gov.hk/api/get.php?id=${e.table}&full_series=1&lang=${lang}` : "https://appapi.towngas.com/opendata/v1/environment/";
  let data: Record<string, unknown>;
  if (e.kind === "spatial") {
    const names = (e.names ?? {}) as Record<string, string>;
    const results = reply.features.map((f: { attributes: Record<string, unknown> }) => {
      const attrs = Object.fromEntries(Object.entries(f.attributes).filter(([, v]) => v !== null));
      return { ...attrs, ...(names[lang] ? { name: attrs[names[lang]] } : {}) };
    });
    data = { results, returned: results.length, hasMore: reply.exceededTransferLimit === true, nextOffset: reply.exceededTransferLimit ? results.length : null, source: url, coordinateSystem: "WGS84 (longitude, latitude)" };
  } else {
    const unitMap: Record<string, string> = e.kind === "census" ? contracts[e.table as keyof typeof contracts].units : {};
    const rows: Record<string, unknown>[] = e.kind === "census" ? reply.dataSet.map((r: Record<string, unknown>) => ({ ...r, measure: unitMap[String(r.svDesc)] })).sort((a: Record<string, unknown>, b: Record<string, unknown>) => String(b.period).localeCompare(String(a.period))) :
      reply.flatMap((g: { description: string; category: { title: string; dataset: Record<string, unknown>[] }[] }) => g.category.flatMap((c) => c.dataset.map((r) => ({ category: g.description, metric: c.title, ...r })))).sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(b.year) - Number(a.year));
    data = { ...(e.kind === "census" ? { table: e.table, title: reply.header.title, language: lang, notes: reply.header.tablenote, source: reply.header.source } : { language: "en", source: url, reportingYears: { first: 2013, last: 2018 } }), total: rows.length, results: rows.slice(0, 3), returned: 3, hasMore: true, nextOffset: 3 };
  }
  return { ...e, lang, file, input, reply, request: { url }, data, ttl: 3600 };
}));
export const profileCase024 = {
  tool: "pland_site_wind_profile", input: { objectId: 1, limit: 3 },
  grid: JSON.parse(fixture024("API-3368.json")), body: fixture024("wind-profile.txt"),
};

export const toolCases024: Case[] = [
  ...cases024.map((c) => ({ ...c, name: c.file + c.lang })),
  { tool: profileCase024.tool, input: profileCase024.input,
    request: { url: "https://portal.csdi.gov.hk/server/rest/services/common/pland_rcd_1634281652589_43389/FeatureServer/0/query?f=json&where=1%3D1+AND+OBJECTID%3D1&outFields=*&outSR=4326&returnGeometry=false&resultRecordCount=1&resultOffset=0&orderByFields=OBJECTID+ASC&geometryPrecision=6" },
    reply: profileCase024.grid,
    lookups: { "https://www.pland.gov.hk/pland_en/resources/site_wind/site_wind/table/annual/g_00337_lev500.txt": profileCase024.body },
    data: expect.objectContaining({ total: 24, returned: 3, nextOffset: 3, grid: "g_00337", results: expect.arrayContaining([expect.objectContaining({ speedBand: "00_to_01" })]) }), ttl: 3600 },
];
