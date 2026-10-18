import { asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import { datasetFromPackage, listPackageIds, showPackage } from "@/lib/catalog/ckan";

export type SyncReport = {
  total: number;
  added: number;
  removed: number;
  fetched: number;
  updated: number;
  unchanged: number;
  failed: number;
  /** Datasets still waiting for their first `package_show`. */
  pending: number;
};

async function mapLimit<T>(items: T[], concurrency: number, deadline: number, run: (item: T) => Promise<void>) {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length && Date.now() < deadline) {
      const item = items[index++];
      await run(item);
    }
  });
  await Promise.all(workers);
}

/**
 * Sync the catalogue: `package_list` for the full id list, then
 * `package_show` for new ids first and then the least recently synced ones.
 * A dataset whose `metadata_modified` hasn't changed is only re-stamped.
 * Bounded by `maxShow` and `budgetMs` so a run fits its time limit;
 * the next run continues where this one stopped.
 */
export async function syncCatalog({ maxShow = 500, concurrency = 8, budgetMs = 240_000 } = {}): Promise<SyncReport> {
  const deadline = Date.now() + budgetMs;
  const ids = await listPackageIds();
  const live = new Set(ids);
  const existing = await db.select({ id: datasets.id, removedAt: datasets.removedAt }).from(datasets);
  const known = new Set(existing.map((row) => row.id));

  const added = ids.filter((id) => !known.has(id));
  for (let start = 0; start < added.length; start += 200) {
    await db
      .insert(datasets)
      .values(added.slice(start, start + 200).map((id) => ({ id, titleEn: id })))
      .onConflictDoNothing();
  }
  const removed = existing.filter((row) => !live.has(row.id) && !row.removedAt).map((row) => row.id);
  const restored = existing.filter((row) => live.has(row.id) && row.removedAt).map((row) => row.id);
  if (removed.length) await db.update(datasets).set({ removedAt: new Date() }).where(inArray(datasets.id, removed));
  if (restored.length) await db.update(datasets).set({ removedAt: null }).where(inArray(datasets.id, restored));

  const queue = await db
    .select({ id: datasets.id, metadataModified: datasets.metadataModified })
    .from(datasets)
    .where(isNull(datasets.removedAt))
    .orderBy(sql`${datasets.syncedAt} is not null`, asc(datasets.syncedAt))
    .limit(maxShow);

  const report = { fetched: 0, updated: 0, unchanged: 0, failed: 0 };
  await mapLimit(queue, concurrency, deadline, async (row) => {
    try {
      const pkg = await showPackage(row.id, "en");
      report.fetched++;
      if (row.metadataModified && row.metadataModified === pkg.metadata_modified) {
        await db.update(datasets).set({ syncedAt: new Date() }).where(eq(datasets.id, row.id));
        report.unchanged++;
        return;
      }
      const tc = await showPackage(row.id, "tc").catch(() => null);
      const values = { ...datasetFromPackage(pkg, tc?.title ?? null), syncedAt: new Date() };
      await db.insert(datasets).values(values).onConflictDoUpdate({ target: datasets.id, set: values });
      report.updated++;
    } catch (error) {
      report.failed++;
      const cause = (error as Error).cause as Error | undefined;
      console.warn(`[catalog-sync] ${row.id}:`, cause?.message ?? (error as Error).message);
    }
  });

  const [{ pending }] = await db
    .select({ pending: sql<number>`count(*)` })
    .from(datasets)
    .where(sql`${datasets.syncedAt} is null and ${datasets.removedAt} is null`);
  return { total: ids.length, added: added.length, removed: removed.length, pending, ...report };
}
