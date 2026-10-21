import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, like, max, or, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import manifest from "@/generated/manifest.json";

/** Dataset id → ids of the mcprouter services built on it. */
export const coveredDatasets = manifest.datasets as Record<string, string[]>;
const coveredIds = Object.keys(coveredDatasets);

export const SOURCES_PAGE_SIZE = 24;

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function contains(column: Parameters<typeof like>[0], query: string) {
  return sql`${column} like ${`%${escapeLike(query)}%`} escape '\\'`;
}

const live = isNull(datasets.removedAt);
const coveredCount = coveredIds.length
  ? sql<number>`sum(case when ${inArray(datasets.id, coveredIds)} then 1 else 0 end)`
  : sql<number>`0`;

// Cache Components are not enabled in this app, so use the Data Cache for these
// public aggregates. A short TTL also picks up syncs run outside the web process.
const cachedCatalogueTotals = unstable_cache(async () => {
  const [row] = await db
    .select({ datasets: count(), providers: sql<number>`count(distinct ${datasets.organization})` })
    .from(datasets)
    .where(live);
  return row ?? { datasets: 0, providers: 0 };
}, ["catalogue-totals-v1", process.env.TURSO_DATABASE_URL ?? "file:local.db"], { revalidate: 300 });

/** Keep pages request-rendered while sharing the expensive totals across requests. */
export async function catalogueTotals() {
  await connection();
  return cachedCatalogueTotals();
}

export type ProviderRow = { id: string; title: string; total: number; apis: number; covered: number };

/** Organisations publishing on DATA.GOV.HK, largest first, searched by name or id. */
export async function listProviders({ query, page }: { query?: string; page: number }) {
  const filters: SQL[] = [live, sql`${datasets.organization} is not null`];
  if (query) filters.push(or(contains(datasets.organizationTitle, query), contains(datasets.organization, query))!);
  const where = and(...filters);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: sql<string>`${datasets.organization}`,
        title: max(datasets.organizationTitle),
        total: count(),
        apis: sql<number>`sum(${datasets.isApi})`,
        covered: coveredCount,
      })
      .from(datasets)
      .where(where)
      .groupBy(datasets.organization)
      .orderBy(desc(count()), asc(datasets.organization))
      .limit(SOURCES_PAGE_SIZE)
      .offset((page - 1) * SOURCES_PAGE_SIZE),
    query
      ? db.select({ total: sql<number>`count(distinct ${datasets.organization})` }).from(datasets).where(where)
      : catalogueTotals().then(({ providers }) => [{ total: providers }]),
  ]);
  return {
    rows: rows.map((row): ProviderRow => ({ ...row, title: row.title || row.id, apis: Number(row.apis ?? 0), covered: Number(row.covered ?? 0) })),
    total: Number(total),
  };
}

export async function getProvider(id: string) {
  const [row] = await db
    .select({ title: max(datasets.organizationTitle), total: count(), apis: sql<number>`sum(${datasets.isApi})`, covered: coveredCount })
    .from(datasets)
    .where(and(live, eq(datasets.organization, id)));
  if (!row || row.total === 0) return null;
  return { id, title: row.title || id, total: row.total, apis: Number(row.apis ?? 0), covered: Number(row.covered ?? 0) };
}

const datasetColumns = {
  id: datasets.id,
  titleEn: datasets.titleEn,
  titleTc: datasets.titleTc,
  organization: datasets.organization,
  organizationTitle: datasets.organizationTitle,
  formats: datasets.formats,
  isApi: datasets.isApi,
  url: datasets.url,
  metadataModified: datasets.metadataModified,
};

/** One provider's datasets: ones mcprouter already serves first, then by title. */
export async function listProviderDatasets(id: string, { query, apiOnly, page }: { query?: string; apiOnly?: boolean; page: number }) {
  const filters: SQL[] = [live, eq(datasets.organization, id)];
  if (query) filters.push(or(contains(datasets.titleEn, query), contains(datasets.titleTc, query), contains(datasets.id, query))!);
  if (apiOnly) filters.push(eq(datasets.isApi, true));
  const where = and(...filters);
  const coveredFirst = coveredIds.length ? sql`case when ${inArray(datasets.id, coveredIds)} then 0 else 1 end` : sql`0`;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select(datasetColumns)
      .from(datasets)
      .where(where)
      .orderBy(coveredFirst, asc(datasets.titleEn))
      .limit(SOURCES_PAGE_SIZE)
      .offset((page - 1) * SOURCES_PAGE_SIZE),
    db.select({ total: count() }).from(datasets).where(where),
  ]);
  return { rows: rows.map((row) => ({ ...row, services: coveredDatasets[row.id] ?? [] })), total };
}

/** Catalogue rows behind a service, in the order the service lists them. */
export async function serviceDatasets(ids: string[]) {
  if (ids.length === 0) return [];
  await connection();
  const rows = await db.select(datasetColumns).from(datasets).where(inArray(datasets.id, ids));
  return ids.map((id) => rows.find((row) => row.id === id) ?? { id, titleEn: id, titleTc: null, organization: null, organizationTitle: null, formats: [], isApi: false, url: null, metadataModified: null });
}

export function findService(id: string) {
  return manifest.services.find((service) => service.id === id || service.aliases.includes(id)) ?? null;
}

export function datasetUrl(row: { id: string; url: string | null }) {
  return row.url || `https://data.gov.hk/en-data/dataset/${row.id}`;
}
