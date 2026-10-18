import { CircleCheck, Clock, ExternalLink, GitPullRequest, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/m3/chip";
import { cn } from "@/components/m3/cn";
import { ButtonLink } from "@/components/m3/button";
import { EmptyState } from "@/components/m3/page-header";
import { LinearProgress } from "@/components/m3/progress";
import { SearchBar } from "@/components/m3/search-bar";
import manifest from "@/generated/manifest.json";
import { API_CATEGORIES, API_STATUSES, apiTracker, filterApis, findApi, type ApiEntry } from "@/lib/apis";
import { listHref } from "../params";
import { SourcesHeader } from "../sources-header";
import { ApiDialog } from "./api-dialog";
import { parseApiParams, type ApiParams } from "./params";

export const metadata: Metadata = {
  title: "API tracker",
  description: "Every Hong Kong open data API mcprouter serves as MCP tools, and the ones coming soon.",
};

const PATH = "/sources/apis";

function href(params: ApiParams) {
  return listHref(PATH, { q: params.q, status: params.status, category: params.category, api: params.api });
}

function StatusBadge({ api }: { api: ApiEntry }) {
  return api.status === "implemented" ? (
    <Badge tone="primary" icon={<CircleCheck size={12} />}>Implemented</Badge>
  ) : (
    <Badge tone="tertiary" icon={<Clock size={12} />}>Coming soon</Badge>
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
  const rows = filterApis(apiTracker.apis, { query: params.q, status: params.status, category: params.category });
  const selected = findApi(params.api);
  const { counts } = apiTracker;
  const total = apiTracker.apis.length;
  const list = { ...params, api: undefined };

  return (
    <>
      <SourcesHeader />

      <section className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <span className="type-label-large text-on-surface-variant">APIs implemented</span>
            <p className="type-display-small tabular-nums">
              {counts.implemented}
              <span className="type-title-large text-on-surface-variant"> / {total}</span>
            </p>
          </div>
          <span className="type-body-medium text-on-surface-variant">{counts["coming-soon"]} coming soon</span>
        </div>
        <LinearProgress value={counts.implemented / total} className="h-2" label="APIs implemented" />
        <p className="type-body-small text-on-surface-variant">
          Each API has a permanent id. Pull requests that add one carry its id, e.g. <code className="font-mono">{apiTracker.nextId}</code> for a new entry.
        </p>
      </section>

      <div className="mt-6">
        <SearchBar action={PATH} query={params.q} label="Search APIs" placeholder="Search by name, id, provider or dataset">
          {params.status ? <input type="hidden" name="status" value={params.status} /> : null}
          {params.category ? <input type="hidden" name="category" value={params.category} /> : null}
        </SearchBar>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
          <FilterLink href={href({ ...list, status: undefined })} selected={!params.status}>All · {total}</FilterLink>
          {(Object.keys(API_STATUSES) as Array<keyof typeof API_STATUSES>).map((status) => (
            <FilterLink key={status} href={href({ ...list, status })} selected={params.status === status}>
              {API_STATUSES[status]} · {counts[status]}
            </FilterLink>
          ))}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Category">
          <FilterLink href={href({ ...list, category: undefined })} selected={!params.category}>All categories</FilterLink>
          {(Object.keys(API_CATEGORIES) as Array<keyof typeof API_CATEGORIES>).map((category) => (
            <FilterLink key={category} href={href({ ...list, category })} selected={params.category === category}>
              {API_CATEGORIES[category]}
            </FilterLink>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={params.q ? `No APIs match “${params.q}”` : "No APIs match these filters"}>Try another search, or clear the filters.</EmptyState>
        </div>
      ) : (
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
                  <StatusBadge api={api} />
                </span>
                <span className="type-title-medium">{api.title}</span>
                <span className="type-body-medium text-on-surface-variant">{api.description}</span>
                <span className="mt-auto type-body-small text-on-surface-variant">
                  {api.provider} · {API_CATEGORIES[api.category]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {selected ? <ApiDetails key={selected.id} api={selected} closeHref={href(list)} /> : null}
    </>
  );
}

function ApiDetails({ api, closeHref }: { api: ApiEntry; closeHref: string }) {
  const services = api.services.map((id) => manifest.services.find((service) => service.id === id)).filter((service) => service !== undefined);
  return (
    <ApiDialog
      title={api.title}
      description={api.description}
      closeHref={closeHref}
      actions={
        <ButtonLink href={api.docs} target="_blank" rel="noreferrer" variant="tonal" icon={<ExternalLink size={18} />}>
          API docs
        </ButtonLink>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-xs bg-surface-container-highest px-2 py-0.5 font-mono text-[13px]">{api.id}</code>
          <StatusBadge api={api} />
          <Badge>{API_CATEGORIES[api.category]}</Badge>
        </div>
        <dl className="grid gap-1">
          <dt className="type-label-large text-on-surface-variant">Provider</dt>
          <dd className="type-body-large">{api.provider}</dd>
        </dl>
        {services.length ? (
          <section>
            <h3 className="mb-2 type-label-large text-on-surface-variant">Served by</h3>
            <ul className="flex flex-col gap-2">
              {services.map((service) => (
                <li key={service.id}>
                  <Link href={`/sources/${service.id}`} className="state-layer flex items-center gap-3 rounded-md bg-surface-container p-3 text-on-surface">
                    <Wrench size={18} className="shrink-0 text-primary" />
                    <span className="flex min-w-0 flex-col">
                      <span className="type-title-small">{service.title}</span>
                      <span className="type-body-small text-on-surface-variant">{service.tools.length} {service.tools.length === 1 ? "tool" : "tools"}</span>
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
              Coming soon. To build it, list <code className="font-mono">{api.id}</code> under <code className="font-mono">apis:</code> in a service YAML and put the id in the pull request title.
            </p>
          </section>
        )}
        <section>
          <h3 className="mb-2 type-label-large text-on-surface-variant">{api.datasets.length === 1 ? "Dataset" : "Datasets"} on DATA.GOV.HK</h3>
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
