import "server-only";
import { isNull } from "drizzle-orm";
import { db } from "@/db";
import { datasets, datasetStatus } from "@/db/schema";
import manifest from "@/generated/manifest.json";
import { resolveRows, type ManualStatus } from "@/lib/tracker";

export async function loadTrackerRows() {
  const [rows, statuses] = await Promise.all([
    db
      .select({
        id: datasets.id,
        titleEn: datasets.titleEn,
        titleTc: datasets.titleTc,
        organization: datasets.organization,
        organizationTitle: datasets.organizationTitle,
        groups: datasets.groups,
        formats: datasets.formats,
        isApi: datasets.isApi,
        syncedAt: datasets.syncedAt,
      })
      .from(datasets)
      .where(isNull(datasets.removedAt)),
    db.select().from(datasetStatus),
  ]);
  const manual = new Map<string, ManualStatus>(statuses.map((row) => [row.datasetId, { status: row.status, reason: row.reason, priority: row.priority }]));
  return resolveRows(rows, manual, manifest.datasets as Record<string, string[]>);
}
