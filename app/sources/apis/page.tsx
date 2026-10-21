import { seoMetadata } from "@/lib/seo";
import { CircleCheck, Clock, ExternalLink, GitPullRequest, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "@/components/localized-link";
import { Badge } from "@/components/m3/chip";
import { cn } from "@/components/m3/cn";
import { ButtonLink } from "@/components/m3/button";
import { EmptyState } from "@/components/m3/page-header";
import { Pagination } from "@/components/m3/pagination";
import { LinearProgress } from "@/components/m3/progress";
import { SearchBar } from "@/components/m3/search-bar";
import manifest from "@/generated/manifest.json";
import {
  API_CATEGORIES,
  API_CATEGORY_LABELS,
  API_KIND_LABELS,
  API_KINDS,
  API_STATUSES,
  API_STATUS_LABELS,
  apiTracker,
  APIS_PAGE_SIZE,
  filterApis,
  findApi,
  type ApiEntry,
} from "@/lib/apis";
import { getT } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
import { listHref } from "../params";
import { SourcesHeader } from "../sources-header";
import { ApiDialog, ApiToolButton } from "./api-dialog";
import { parseApiParams, type ApiParams } from "./params";

export async function generateMetadata({ searchParams }: PageProps<"/sources/apis">): Promise<Metadata> {
  const t = await getT();
  const selected = findApi(parseApiParams(await searchParams).api);
  if (selected) {
    const metadata = await seoMetadata(selected.title, selected.description, `/sources/api/${selected.id}`);
    return { ...metadata, ...(selected.status === "coming-soon" ? { robots: { index: false, follow: true } } : {}) };
  }
  return seoMetadata(t("MCP APIs"), t("Every open data API mcprouter serves as MCP tools, and the ones coming soon."));
}

const PATH = "/sources/apis";

function href(params: ApiParams) {
  return listHref(PATH, { q: params.q, status: params.status, category: params.category, kind: params.kind, page: params.page, api: params.api });
}

function StatusBadge({ api, t }: { api: ApiEntry; t: Translator }) {
  return api.status === "implemented" ? (
    <Badge tone="primary" icon={<CircleCheck size={12} />}>{t("Implemented")}</Badge>
  ) : (
    <Badge tone="tertiary" icon={<Clock size={12} />}>{t("Coming soon")}</Badge>
  );
}

function FilterLink({ href, selected, children }: { href: string; selected: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "state-layer inline-flex h-8 items-center gap-1.5 rounded-sm px-3 type-label-large whitespace-nowrap transition-colors duration-200 ease-emphasized",
        selected ? "bg-secondary-container text-on-secondary-container" : "border border-outline text-on-surface-variant",
      )}
    >
      {children}
    </Link>
  );
}

export default async function ApisPage({ searchParams }: PageProps<"/sources/apis">) {
  const params = parseApiParams(await searchParams);
  const matches = filterApis(apiTracker.apis, { query: params.q, status: params.status, category: params.category, kind: params.kind });
  const pageCount = Math.max(1, Math.ceil(matches.length / APIS_PAGE_SIZE));
  const page = Math.min(params.page, pageCount);
  const rows = matches.slice((page - 1) * APIS_PAGE_SIZE, page * APIS_PAGE_SIZE);
  const selected = findApi(params.api);
  const { counts } = apiTracker;
  const total = apiTracker.apis.length;
  // Changing a filter starts again from page 1; opening a dialog keeps the page.
  const list = { ...params, page, api: undefined };
  const filters = { ...list, page: 1 };
  const t = await getT();

  return (
    <>
      <SourcesHeader />

      <section className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <span className="type-label-large text-on-surface-variant">{t("APIs implemented")}</span>
            <p className="type-display-small tabular-nums">
              {counts.implemented}
              <span className="type-title-large text-on-surface-variant"> / {total}</span>
            </p>
          </div>
          <span className="type-body-medium text-on-surface-variant">{t("{count} coming soon", { count: counts["coming-soon"] })}</span>
        </div>
        <LinearProgress value={counts.implemented / total} className="h-2" label={t("APIs implemented")} />
        <p className="type-body-small text-on-surface-variant">
          {t.rich("Each API has a permanent id. Pull requests that add one carry its id, e.g. {id} for a new entry.", { id: <code className="font-mono">{apiTracker.nextId}</code> })}
        </p>
      </section>

      <div className="mt-6">
        <SearchBar action={PATH} query={params.q} label={t("Search APIs")} placeholder={t("Search by name, id, provider or dataset")}>
          {params.status ? <input type="hidden" name="status" value={params.status} /> : null}
          {params.category ? <input type="hidden" name="category" value={params.category} /> : null}
          {params.kind ? <input type="hidden" name="kind" value={params.kind} /> : null}
        </SearchBar>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("Status")}>
          <FilterLink href={href({ ...filters, status: undefined })} selected={!params.status}>{t("All · {total}", { total })}</FilterLink>
          {(Object.keys(API_STATUSES) as Array<keyof typeof API_STATUSES>).map((status) => (
            <FilterLink key={status} href={href({ ...filters, status })} selected={params.status === status}>
              {t(API_STATUS_LABELS[status])} · {counts[status]}
            </FilterLink>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("Type")}>
          <FilterLink href={href({ ...filters, kind: undefined })} selected={!params.kind}>{t("All types")}</FilterLink>
          {(Object.keys(API_KINDS) as Array<keyof typeof API_KINDS>).map((kind) => (
            <FilterLink key={kind} href={href({ ...filters, kind })} selected={params.kind === kind}>
              {t(API_KIND_LABELS[kind])}
            </FilterLink>
          ))}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label={t("Category")}>
          <FilterLink href={href({ ...filters, category: undefined })} selected={!params.category}>{t("All categories")}</FilterLink>
          {(Object.keys(API_CATEGORIES) as Array<keyof typeof API_CATEGORIES>).map((category) => (
            <FilterLink key={category} href={href({ ...filters, category })} selected={params.category === category}>
              {t(API_CATEGORY_LABELS[category])}
            </FilterLink>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={params.q ? t("No APIs match “{query}”", { query: params.q }) : t("No APIs match these filters")}>{t("Try another search, or clear the filters.")}</EmptyState>
        </div>
      ) : (
        <>
          <ul className="stagger mt-6 grid gap-3 md:grid-cols-2" data-testid="api-list">
            {rows.map((api) => (
              <li key={api.id}>
                <Link
                  href={href({ ...list, api: api.id })}
                  scroll={false}
                  className="state-layer flex h-full flex-col gap-2 rounded-lg border border-outline-variant p-4 text-on-surface"
                >
                  <span className="flex items-center justify-between gap-2">
                    <code className="rounded-xs bg-surface-container-high px-2 py-0.5 font-mono text-[13px] text-on-surface-variant">{api.id}</code>
                    <StatusBadge api={api} t={t} />
                  </span>
                  <span className="type-title-medium">{api.title}</span>
                  <span className="line-clamp-3 type-body-medium text-on-surface-variant">{api.description}</span>
                  <span className="mt-auto type-body-small text-on-surface-variant">
                    {api.provider} · {t(API_CATEGORY_LABELS[api.category])} · {t(API_KIND_LABELS[api.kind])}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {pageCount > 1 ? <Pagination page={page} pageCount={pageCount} total={matches.length} noun={t.plural("API", "APIs", matches.length)} href={(next) => href({ ...list, page: next })} /> : null}
        </>
      )}

      {selected ? <ApiDetails key={selected.id} api={selected} closeHref={href(list)} t={t} /> : null}
    </>
  );
}

function ApiDetails({ api, closeHref, t }: { api: ApiEntry; closeHref: string; t: Translator }) {
  const services = api.services.map((id) => manifest.services.find((service) => service.id === id)).filter((service) => service !== undefined);
  return (
    <ApiDialog
      apiId={api.id}
      canChat={api.status === "implemented" && services.some((service) => service.tools.length > 0)}
      title={api.title}
      description={api.description}
      closeHref={closeHref}
      actions={
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/sources/api/${api.id}`} variant="outlined">{t("API details")}</ButtonLink>
          <ButtonLink href={api.docs} target="_blank" rel="noreferrer" variant="tonal" icon={<ExternalLink size={18} />}>
            {t("API docs")}
          </ButtonLink>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-xs bg-surface-container-highest px-2 py-0.5 font-mono text-[13px]">{api.id}</code>
          <StatusBadge api={api} t={t} />
          <Badge>{t(API_CATEGORY_LABELS[api.category])}</Badge>
          <Badge>{t(API_KIND_LABELS[api.kind])}</Badge>
        </div>
        <dl className="grid gap-1">
          <dt className="type-label-large text-on-surface-variant">{t("Provider")}</dt>
          <dd className="type-body-large">{api.provider}</dd>
        </dl>
        {services.length ? (
          <section>
            <h3 className="mb-2 type-title-medium">{t("Available tools")}</h3>
            <ul className="flex flex-col gap-2">
              {services.flatMap((service) => service.tools).map((tool) => (
                <li key={tool.name} className="rounded-md border border-outline-variant p-3">
                  <ApiToolButton name={tool.name} />
                  <p className="mt-1 type-body-small text-on-surface-variant">{tool.description}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {api.status === "implemented" && services.some((service) => service.tools.length > 0) ? (
          <section>
            <h3 className="mb-2 type-title-medium">{t("Display tools")}</h3>
            <ul className="flex flex-col gap-2">
              <li className="rounded-md border border-outline-variant p-3"><ApiToolButton name="show_ui" /><p className="mt-1 type-body-small text-on-surface-variant">{t("Show a custom view of the results.")}</p></li>
              <li className="rounded-md border border-outline-variant p-3"><ApiToolButton name="show_tool_ui" /><p className="mt-1 type-body-small text-on-surface-variant">{t("Show an API tool's visual app.")}</p></li>
              <li className="rounded-md border border-outline-variant p-3"><ApiToolButton name="show_map" /><p className="mt-1 type-body-small text-on-surface-variant">{t("Show a map with pins and routes.")}</p></li>
            </ul>
          </section>
        ) : null}
        {services.length ? (
          <section>
            <h3 className="mb-2 type-label-large text-on-surface-variant">{t("Served by")}</h3>
            <ul className="flex flex-col gap-2">
              {services.map((service) => (
                <li key={service.id}>
                  <Link href={`/sources/${service.id}`} className="state-layer flex items-center gap-3 rounded-md bg-surface-container p-3 text-on-surface">
                    <Wrench size={18} className="shrink-0 text-primary" />
                    <span className="flex min-w-0 flex-col">
                      <span className="type-title-small">{service.title}</span>
                      <span className="type-body-small text-on-surface-variant">{t.plural("{count} tool", "{count} tools", service.tools.length)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="flex gap-3 rounded-md bg-tertiary-container p-3 text-on-tertiary-container">
            <GitPullRequest size={20} className="mt-0.5 shrink-0" />
            <p className="type-body-medium">
              {t.rich("Coming soon. To build it, list {id} under {key} in a service YAML and put the id in the pull request title.", {
                id: <code className="font-mono">{api.id}</code>,
                key: <code className="font-mono">apis:</code>,
              })}
            </p>
          </section>
        )}
        <section>
          <h3 className="mb-2 type-label-large text-on-surface-variant">{t.plural("Dataset on DATA.GOV.HK", "Datasets on DATA.GOV.HK", api.datasets.length)}</h3>
          <ul className="flex flex-col gap-1">
            {api.datasets.map((id) => (
              <li key={id}>
                <a
                  href={`https://data.gov.hk/en-data/dataset/${id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center gap-1.5 break-all font-mono text-[13px] text-primary hover:underline"
                >
                  {id} <ExternalLink size={14} className="shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ApiDialog>
  );
}
