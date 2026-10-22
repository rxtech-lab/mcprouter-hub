import Papa from "papaparse";
import { stripBom } from "@/lib/mcp/fetcher";
import { malformed, page } from "@/lib/mcp/spatial";
import type { ToolHandler } from "@/lib/mcp/types";

type Lang = "en" | "tc" | "sc";
type Kind = "marine" | "river" | "historical";
const identity: Record<Lang, string[]> = {
  en: ["Water Control Zone", "River", "Station", "Dates", "Sample No"],
  tc: ["水質管制區", "河溪", "監測站", "日期", "樣本編號"],
  sc: ["水质管制区", "河溪", "监测站", "日期", "样本编号"],
};
const monthlyDate: Record<Lang, string> = {
  en: "Sampling Date (MM/YYYY)", tc: "樣本日期 (MM/YYYY)", sc: "样本日期 (MM/YYYY)",
};

function waterQuality(kind: Kind): ToolHandler {
  return async (input, context) => {
    const lang = String(input.lang ?? "en") as Lang;
    const historical = kind === "historical";
    const river = kind !== "marine";
    const family = river ? "river" : "marine";
    const source = historical
      ? `https://cd.epic.epd.gov.hk/riverpsi/${lang}/riverhistorical/river-historical-${input.year}-${lang}.csv`
      : `https://cd.epic.epd.gov.hk/${family}psi/${lang}/${family}recent/${family}-recent-${lang}.csv`;
    const body = await context.fetchUpstream(source, { format: "text" });
    if (typeof body !== "string") malformed(source);
    const parsed = Papa.parse<string[]>(stripBom(body).trim(), { skipEmptyLines: "greedy" });
    const [header, ...rows] = parsed.data;
    const prefix = historical ? identity[lang] : [identity[lang][0], ...(river ? [identity[lang][1]] : []), identity[lang][2], monthlyDate[lang]];
    const columns = historical ? 56 : river ? 6 : 5;
    if (parsed.errors.length || header?.length !== columns || new Set(header).size !== columns ||
        prefix.some((label, index) => header[index] !== label) ||
        rows.some((row) => row.length !== columns)) malformed(source);
    const stationIndex = river ? 2 : 1;
    const dateIndex = stationIndex + 1;
    const normalized = rows.map((row) => {
      const date = row[dateIndex];
      // Some 1986 TR20A observations have no zone/river labels. Keep them as
      // published; station/date still identify the observation unambiguously.
      if (!row[stationIndex] ||
          !(historical ? /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/ : /^(0[1-9]|1[0-2])\/\d{4}$/).test(date)) malformed(source);
      return {
        waterControlZone: row[0], ...(river ? { river: row[1] } : {}), station: row[stationIndex],
        date: historical ? date : `${date.slice(3)}-${date.slice(0, 2)}`,
        ...(historical ? { sampleNumber: row[4] } : {}),
        // Preserve detection bounds and the source's localized measurement labels/units.
        measurements: Object.fromEntries(header.slice(prefix.length).map((key, index) => {
          const value = row[prefix.length + index].trim();
          return [key, !value || value === "null" ? null : value];
        })),
      };
    });
    const needle = String(input.search ?? "").trim().toLowerCase();
    const filtered = normalized.filter((row) =>
      (!input.station || row.station.toLowerCase() === String(input.station).toLowerCase()) &&
      (!input.month || row.date === `${String(input.month).slice(3)}-${String(input.month).slice(0, 2)}`) &&
      (!needle || [row.waterControlZone, row.river ?? "", row.station].some((value) => value.toLowerCase().includes(needle))));
    const offset = Number(input.offset ?? 0);
    return { ...page(filtered.slice(offset), offset, Number(input.limit ?? 20)), total: filtered.length,
      source, language: lang, datePrecision: historical ? "day" : "month" };
  };
}

export const recentMarine = waterQuality("marine");
export const recentRiver = waterQuality("river");
export const historicalRiver = waterQuality("historical");
