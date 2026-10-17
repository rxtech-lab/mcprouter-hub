import type { ManualDatasetStatus } from "@/db/schema";

/**
 * Conversion tracker logic, kept free of I/O so the page, the terminal report
 * and the tests share it. `converted` comes from the generated manifest (the
 * dataset ids each service's YAML lists); everything else is manual or
 * `not_started`.
 */

export const TRACKER_STATUSES = ["converted", "in_progress", "planned", "skipped", "not_started"] as const;
export type TrackerStatus = (typeof TRACKER_STATUSES)[number];

export const STATUS_LABELS: Record<TrackerStatus, string> = {
  converted: "Converted",
  in_progress: "In progress",
  planned: "Planned",
  skipped: "Skipped",
  not_started: "Not started",
};

export type TrackerDataset = {
  id: string;
  titleEn: string;
  titleTc: string | null;
  organization: string | null;
  organizationTitle: string | null;
  groups: string[];
  formats: string[];
  isApi: boolean;
  syncedAt: Date | null;
};

export type ManualStatus = { status: ManualDatasetStatus; reason: string | null; priority: number };

export type TrackerRow = TrackerDataset & {
  status: TrackerStatus;
  services: string[];
  reason: string | null;
  priority: number;
};

export function resolveRows(
  datasets: TrackerDataset[],
  manual: Map<string, ManualStatus>,
  converted: Record<string, string[]>,
): TrackerRow[] {
  return datasets.map((dataset) => {
    const services = converted[dataset.id] ?? [];
    const entry = manual.get(dataset.id);
    return {
      ...dataset,
      services,
      status: services.length ? "converted" : (entry?.status ?? "not_started"),
      reason: entry?.reason ?? null,
      priority: entry?.priority ?? 0,
    };
  });
}

export type Progress = { key: string; label: string; total: number; converted: number; counts: Record<TrackerStatus, number> };

function emptyCounts(): Record<TrackerStatus, number> {
  return { converted: 0, in_progress: 0, planned: 0, skipped: 0, not_started: 0 };
}

function tally(rows: TrackerRow[], key: string, label: string): Progress {
  const counts = emptyCounts();
  for (const row of rows) counts[row.status]++;
  return { key, label, total: rows.length, converted: counts.converted, counts };
}

/** "climate-and-weather" → "Climate and weather". */
export function humanise(slug: string) {
  const text = slug.replace(/-/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function groupBy(rows: TrackerRow[], keys: (row: TrackerRow) => string[], label: (key: string, rows: TrackerRow[]) => string) {
  const buckets = new Map<string, TrackerRow[]>();
  for (const row of rows) for (const key of keys(row)) (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(row);
  return [...buckets]
    .map(([key, bucket]) => tally(bucket, key, label(key, bucket)))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

export function summarise(rows: TrackerRow[]) {
  return {
    overall: tally(rows, "all", "All datasets"),
    apiOnly: tally(rows.filter((row) => row.isApi), "api", "Real API endpoints"),
    byCategory: groupBy(rows, (row) => (row.groups.length ? row.groups : ["uncategorised"]), (key) => humanise(key)),
    byProvider: groupBy(
      rows,
      (row) => [row.organization ?? "unknown"],
      (key, bucket) => bucket[0]?.organizationTitle ?? key,
    ),
  };
}

export type TrackerFilters = { status?: TrackerStatus; format?: string; apiOnly?: boolean; provider?: string; category?: string; query?: string };

export function filterRows(rows: TrackerRow[], filters: TrackerFilters) {
  const query = filters.query?.trim().toLowerCase();
  return rows
    .filter((row) => !filters.status || row.status === filters.status)
    .filter((row) => !filters.format || row.formats.includes(filters.format))
    .filter((row) => !filters.apiOnly || row.isApi)
    .filter((row) => !filters.provider || row.organization === filters.provider)
    .filter((row) => !filters.category || row.groups.includes(filters.category))
    .filter((row) => !query || row.id.includes(query) || row.titleEn.toLowerCase().includes(query) || (row.titleTc ?? "").includes(query))
    .sort((a, b) => b.priority - a.priority || Number(b.isApi) - Number(a.isApi) || a.id.localeCompare(b.id));
}

export function percent(part: number, total: number) {
  return total ? `${((part / total) * 100).toFixed(1)}%` : "0%";
}
