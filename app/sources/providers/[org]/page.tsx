import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "@/components/m3/cn";
import { EmptyState } from "@/components/m3/page-header";
import { Pagination } from "@/components/m3/pagination";
import { SearchBar } from "@/components/m3/search-bar";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { getProvider, listProviderDatasets, SOURCES_PAGE_SIZE } from "@/lib/sources";
import { BackLink } from "../../back-link";
import { DatasetItem } from "../../dataset-item";
import { listHref, parseListParams } from "../../params";

export async function generateMetadata({ params }: PageProps<"/sources/providers/[org]">): Promise<Metadata> {
  const provider = await getProvider(decodeURIComponent((await params).org));
  const t = await getT();
  return provider ? { title: provider.title, description: t("Datasets {provider} publishes on DATA.GOV.HK.", { provider: provider.title }) } : {};
}

export default async function ProviderPage({ params, searchParams }: PageProps<"/sources/providers/[org]">) {
  const id = decodeURIComponent((await params).org);
  const filters = parseListParams(await searchParams);
  const provider = await getProvider(id);
  if (!provider) notFound();
  const { rows, total } = await listProviderDatasets(id, { query: filters.q, apiOnly: filters.api === "1", page: filters.page });
  const pageCount = Math.max(1, Math.ceil(total / SOURCES_PAGE_SIZE));
  const path = `/sources/providers/${encodeURIComponent(id)}`;
  const t = await getT();

  const stats = [
    { label: t("Datasets"), value: provider.total },
    { label: t("With APIs"), value: provider.apis },
    { label: t("In mcprouter"), value: provider.covered },
  ];

  return (
    <>
      <BackLink href="/sources/providers">{t("Providers")}</BackLink>
      <h1 className="type-headline-large">{provider.title}</h1>
      <dl className="mt-6 grid max-w-xl grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg bg-surface-container-low p-4">
            <dt className="type-label-large text-on-surface-variant">{stat.label}</dt>
            <dd className="mt-1 type-headline-small tabular-nums">{formatNumber(stat.value, t.locale)}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8">
        <SearchBar action={path} query={filters.q} label={t("Search {provider} datasets", { provider: provider.title })} placeholder={t("Search this provider's datasets")}>
          {filters.api ? <input type="hidden" name="api" value="1" /> : null}
        </SearchBar>
        <div className="mt-3 flex gap-2" role="group" aria-label={t("Endpoints")}>
          {[
            { label: t("All datasets"), api: undefined },
            { label: t("With APIs"), api: "1" },
          ].map((option) => {
            const selected = filters.api === option.api;
            return (
              <Link
                key={option.label}
                href={listHref(path, { q: filters.q, api: option.api })}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "state-layer inline-flex h-8 items-center rounded-sm px-3 type-label-large",
                  selected ? "bg-secondary-container text-on-secondary-container" : "border border-outline text-on-surface-variant",
                )}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
        {rows.length === 0 ? (
          <div className="mt-6">
            <EmptyState title={t("No datasets match")}>{t("Try another search, or show all datasets.")}</EmptyState>
          </div>
        ) : (
          <>
            <ul className="mt-4 flex flex-col gap-3">
              {rows.map((row) => <DatasetItem key={row.id} dataset={row} services={row.services} />)}
            </ul>
            <Pagination page={filters.page} pageCount={pageCount} total={total} noun={t.plural("dataset", "datasets", total)} href={(page) => listHref(path, { q: filters.q, api: filters.api, page })} />
          </>
        )}
      </section>
    </>
  );
}
