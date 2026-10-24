import { record, malformed, page } from "@/lib/mcp/spatial";
import type { ResponseTransformer } from "@/lib/mcp/types";

export const normalize: ResponseTransformer = (body, input) => {
  if (!Array.isArray(body)) malformed("Towngas environmental performance");
  const rows: Record<string, unknown>[] = [];
  for (const group of body) {
    if (!record(group) || typeof group.description !== "string" || !Array.isArray(group.category)) malformed("Towngas categories");
    for (const metric of group.category) {
      if (!record(metric) || typeof metric.title !== "string" || !Array.isArray(metric.dataset)) malformed("Towngas metric");
      for (const observation of metric.dataset) {
        if (!record(observation) || !Number.isInteger(observation.year) || Number(observation.year) < 1900 || Number(observation.year) > 2100 ||
            typeof observation.unit !== "string" || typeof observation.value !== "string" || !/^-?\d+(\.\d+)?$/.test(observation.value)) malformed("Towngas observation");
        rows.push({ category: group.description, metric: metric.title, ...observation });
      }
    }
  }
  const search = String(input.search ?? "").trim().toLowerCase();
  const filtered = rows.filter((r) => (input.year === undefined || r.year === input.year) &&
    (!search || `${r.category} ${r.metric}`.toLowerCase().includes(search))).sort((a, b) => Number(b.year) - Number(a.year));
  const offset = Number(input.offset ?? 0);
  const years = rows.map((r) => Number(r.year));
  return { language: "en", source: "https://appapi.towngas.com/opendata/v1/environment/", reportingYears: years.length ? { first: Math.min(...years), last: Math.max(...years) } : null,
    total: filtered.length, ...page(filtered.slice(offset), offset, Number(input.limit ?? 20)) };
};
