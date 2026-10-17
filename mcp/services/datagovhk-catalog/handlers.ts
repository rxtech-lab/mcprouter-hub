import { and, eq, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import manifest from "@/generated/manifest.json";
import type { ToolHandler } from "@/lib/mcp/types";

const converted = manifest.datasets as Record<string, string[]>;

export const searchDatasets: ToolHandler = async (input) => {
  const query = typeof input.query === "string" ? input.query.trim() : "";
  const conditions = [isNull(datasets.removedAt)];
  if (query) {
    const pattern = `%${query}%`;
    conditions.push(or(like(datasets.titleEn, pattern), like(datasets.titleTc, pattern), like(datasets.id, pattern))!);
  }
  if (typeof input.provider === "string" && input.provider) conditions.push(eq(datasets.organization, input.provider));
  if (typeof input.category === "string" && input.category) {
    conditions.push(sql`exists (select 1 from json_each(${datasets.groups}) where json_each.value = ${input.category})`);
  }
  if (input.apiOnly) conditions.push(eq(datasets.isApi, true));

  const rows = await db
    .select()
    .from(datasets)
    .where(and(...conditions))
    .orderBy(datasets.id)
    .limit(Number(input.limit ?? 20));

  if (rows.length === 0) {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(datasets);
    if (count === 0) return { results: [], note: "The local catalogue has not been synced yet. Try datagovhk_dataset_details with a known dataset id." };
  }

  return {
    results: rows.map((row) => ({
      id: row.id,
      title: row.titleEn,
      titleTc: row.titleTc,
      provider: row.organizationTitle ?? row.organization,
      categories: row.groups,
      formats: row.formats,
      hasApi: row.isApi,
      url: row.url,
      mcprouterServices: converted[row.id] ?? [],
    })),
  };
};

export const getArchivedFile: ToolHandler = async (input, context) => {
  const url = new URL("https://api.data.gov.hk/v1/historical-archive/get-file");
  url.searchParams.set("url", String(input.url));
  url.searchParams.set("time", String(input.time));
  const text = (await context.fetchUpstream(url.toString(), { format: "text", cacheTtl: 86400 })) as string;
  const max = Number(input.maxChars ?? 20000);
  return { content: text.slice(0, max), omittedCharacters: Math.max(0, text.length - max) };
};

function parseJsonArray(value: unknown, name: string) {
  if (value === undefined || value === null || value === "") return undefined;
  try {
    const parsed = JSON.parse(String(value));
    if (!Array.isArray(parsed)) throw new Error("not an array");
    return parsed;
  } catch {
    throw new Error(`${name} must be a JSON array`);
  }
}

export const filterCsv: ToolHandler = async (input, context) => {
  const q = {
    resource: String(input.resource),
    section: Number(input.section ?? 1),
    format: "json",
    ...(parseJsonArray(input.filters, "filters") ? { filters: parseJsonArray(input.filters, "filters") } : {}),
    ...(parseJsonArray(input.sorts, "sorts") ? { sorts: parseJsonArray(input.sorts, "sorts") } : {}),
  };
  const url = new URL("https://api.data.gov.hk/v2/filter");
  url.searchParams.set("q", JSON.stringify(q));
  const rows = await context.fetchUpstream(url.toString(), { format: "json" });
  if (!Array.isArray(rows)) return rows;
  const limit = Number(input.limit ?? 100);
  return { rows: rows.slice(0, limit), total: rows.length, truncated: rows.length > limit };
};
