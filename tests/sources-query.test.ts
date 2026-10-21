import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import { catalogueTotals, getProvider, listProviders } from "@/lib/sources";

vi.hoisted(async () => {
  // Next's server bootstrap normally installs this before loading its cache API.
  const { AsyncLocalStorage } = await import("node:async_hooks");
  vi.stubGlobal("AsyncLocalStorage", AsyncLocalStorage);
});

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

// Exercise Next's real unstable_cache with an in-memory backing store, without
// starting a server or accessing a deployment's Data Cache.
type Entry = { value: { revalidate: number }; isStale: boolean };
const entries = new Map<string, Entry>();
const cacheSet = vi.fn(async (key: string, value: Entry["value"]) => {
  entries.set(key, { value, isStale: false });
});

beforeAll(async () => {
  vi.stubGlobal("__incrementalCache", {
    generateSimpleCacheKey: async (key: string) => key,
    get: async (key: string) => entries.get(key) ?? null,
    set: cacheSet,
  });
  await migrate(db, { migrationsFolder: "db/migrations" });
});

beforeEach(async () => {
  entries.clear();
  cacheSet.mockClear();
  await db.delete(datasets);
  await db.insert(datasets).values([
    { id: "a1", organization: "alpha", organizationTitle: "Alpha", isApi: true },
    { id: "a2", organization: "alpha", organizationTitle: "Alpha" },
    { id: "b1", organization: "beta", organizationTitle: "Beta" },
    { id: "unknown" },
    { id: "removed", organization: "old", removedAt: new Date() },
    { id: "removed-alpha", organization: "alpha", isApi: true, removedAt: new Date() },
  ]);
});

afterAll(() => vi.unstubAllGlobals());

describe("catalogue query costs", () => {
  it("uses the covering active/provider index for the screenshot's totals query", async () => {
    const plan = await db.$client.execute('explain query plan select count(*), count(distinct organization) from datasets where removed_at is null');
    expect(plan.rows.map((row) => row.detail).join("\n")).toContain("COVERING INDEX datasets_live_org_idx");
    expect(await catalogueTotals()).toEqual({ datasets: 4, providers: 2 });
  });

  it("uses both index columns to restrict provider queries to active rows", async () => {
    const plan = await db.$client.execute({
      sql: 'explain query plan select max(organization_title), count(*), sum(is_api) from datasets where removed_at is null and organization = ?',
      args: ["alpha"],
    });
    expect(plan.rows.map((row) => row.detail).join("\n")).toContain("datasets_live_org_idx (removed_at=? AND organization=?)");
    expect(await getProvider("alpha")).toMatchObject({ total: 2, apis: 1 });
    expect(await getProvider("old")).toBeNull();
  });

  it("reuses totals across calls and refreshes an expired cache entry", async () => {
    expect(await catalogueTotals()).toEqual({ datasets: 4, providers: 2 });
    await db.insert(datasets).values({ id: "new", organization: "gamma" });
    expect(await catalogueTotals()).toEqual({ datasets: 4, providers: 2 });
    expect(cacheSet).toHaveBeenCalledTimes(1);
    expect([...entries.values()][0].value.revalidate).toBe(300);
    for (const entry of entries.values()) entry.isStale = true;
    expect(await catalogueTotals()).toEqual({ datasets: 5, providers: 3 });
    expect(cacheSet).toHaveBeenCalledTimes(2);
  });

  it("shares cached totals with the unfiltered provider list, but counts searches separately", async () => {
    await catalogueTotals();
    const select = vi.spyOn(db, "select");
    try {
      const all = await listProviders({ page: 1 });
      expect(all.total).toBe(2);
      expect(all.rows.map((row) => row.id)).toEqual(["alpha", "beta"]);
      expect(select).toHaveBeenCalledTimes(1);
      select.mockClear();
      const filtered = await listProviders({ query: "Alpha", page: 1 });
      expect(filtered.total).toBe(1);
      expect(filtered.rows[0]).toMatchObject({ id: "alpha", total: 2 });
      expect(select).toHaveBeenCalledTimes(2);
    } finally {
      select.mockRestore();
    }
  });
});
