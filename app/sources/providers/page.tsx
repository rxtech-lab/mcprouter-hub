import { seoMetadata } from "@/lib/seo";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "@/components/localized-link";
import { Badge } from "@/components/m3/chip";
import { EmptyState } from "@/components/m3/page-header";
import { Pagination } from "@/components/m3/pagination";
import { SearchBar } from "@/components/m3/search-bar";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { listProviders, SOURCES_PAGE_SIZE } from "@/lib/sources";
import { listHref, parseListParams } from "../params";
import { SourcesHeader } from "../sources-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return seoMetadata(t("Data providers"), t("Search the government departments and organisations publishing on DATA.GOV.HK."));
}

export default async function ProvidersPage({ searchParams }: PageProps<"/sources/providers">) {
  const params = parseListParams(await searchParams);
  const { rows, total } = await listProviders({ query: params.q, page: params.page });
  const pageCount = Math.max(1, Math.ceil(total / SOURCES_PAGE_SIZE));
  const t = await getT();

  return (
    <>
      <SourcesHeader />
      <SearchBar action="/sources/providers" query={params.q} label={t("Search providers")} placeholder={t("Search departments and organisations")} />
      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={params.q ? t("No providers match “{query}”", { query: params.q }) : t("The catalogue hasn't been synced yet")}>
            {params.q ? t("Try a shorter name, or an abbreviation such as HKO or TD.") : t("Provider details appear after the daily DATA.GOV.HK catalogue sync.")}
          </EmptyState>
        </div>
      ) : (
        <>
          <ul className="stagger mt-6 grid gap-3 md:grid-cols-2" data-testid="provider-list">
            {rows.map((provider) => (
              <li key={provider.id}>
                <Link href={`/sources/providers/${encodeURIComponent(provider.id)}`} className="state-layer flex h-full items-center gap-4 rounded-lg border border-outline-variant p-4 text-on-surface">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary-container type-title-medium text-on-secondary-container">
                    {provider.title.replace(/^(The )/, "").charAt(0)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="type-title-medium">{provider.title}</span>
                    <span className="flex flex-wrap items-center gap-2 type-body-small text-on-surface-variant">
                      {t.plural("{n} dataset", "{n} datasets", provider.total, { n: formatNumber(provider.total, t.locale) })}
                      {provider.apis ? <> · {t("{n} with APIs", { n: formatNumber(provider.apis, t.locale) })}</> : null}
                      {provider.covered ? <Badge tone="primary">{t("{count} in mcprouter", { count: provider.covered })}</Badge> : null}
                    </span>
                  </span>
                  <ChevronRight size={20} className="shrink-0 text-on-surface-variant" />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={params.page} pageCount={pageCount} total={total} noun={t.plural("provider", "providers", total)} href={(page) => listHref("/sources/providers", { q: params.q, page })} />
        </>
      )}
    </>
  );
}
