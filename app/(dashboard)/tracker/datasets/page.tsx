import { X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/components/m3/cn";
import { Pagination } from "@/components/m3/pagination";
import { SearchBar } from "@/components/m3/search-bar";
import { isAdmin, requirePageUser } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { filterRows, humanise, STATUS_LABELS, TRACKER_STATUSES, type TrackerFilters, type TrackerRow } from "@/lib/tracker";
import { loadTrackerRows } from "@/lib/tracker-data";
import { datasetsHref, parseDatasetParams, type DatasetParams } from "../params";
import { NotSynced } from "../tracker-ui";
import { DatasetTable, type Row } from "../dataset-table";
import { FiltersButton } from "./filters-button";

export const metadata = { title: "Tracker · Datasets" };

const PAGE_SIZE = 25;

function toFilters(params: DatasetParams): TrackerFilters {
  return { status: params.status, format: params.format, apiOnly: params.api === "1", provider: params.provider, category: params.category, query: params.q };
}

function serialise(row: TrackerRow): Row {
  return { ...row, syncedAt: row.syncedAt?.toISOString() ?? null };
}

function LinkChip({ href, selected, children }: { href: string; selected: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "state-layer inline-flex h-8 items-center gap-2 rounded-sm px-3 type-label-large whitespace-nowrap",
        selected ? "bg-secondary-container text-on-secondary-container" : "border border-outline text-on-surface-variant",
      )}
    >
      {children}
    </Link>
  );
}

export default async function TrackerDatasetsPage({ searchParams }: PageProps<"/tracker/datasets">) {
  const user = await requirePageUser();
  const params = parseDatasetParams(await searchParams);
  const rows = await loadTrackerRows();
  if (rows.length === 0) return <NotSynced />;

  const filters = { q: params.q, status: params.status, format: params.format, api: params.api, provider: params.provider, category: params.category };
  const href = (overrides: Partial<Record<keyof DatasetParams, string | number | undefined>>) => datasetsHref({ ...filters, ...overrides });

  const filtered = filterRows(rows, toFilters(params));
  const anyStatus = params.status ? filterRows(rows, toFilters({ ...params, status: undefined })) : filtered;
  const statusCounts = Object.fromEntries(TRACKER_STATUSES.map((status) => [status, anyStatus.filter((row) => row.status === status).length]));

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(params.page, pageCount);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (overrides: Partial<Record<keyof DatasetParams, string | number | undefined>> = {}) => href({ page, ...overrides });
  const selected = params.dataset ? rows.find((row) => row.id === params.dataset) : undefined;
  const formats = [...new Set(rows.flatMap((row) => row.formats))].sort();

  const providerLabel = params.provider ? (rows.find((row) => row.organization === params.provider)?.organizationTitle ?? params.provider) : null;
  const active = [
    params.category ? { label: `Category: ${humanise(params.category)}`, remove: href({ category: undefined }) } : null,
    providerLabel ? { label: `Provider: ${providerLabel}`, remove: href({ provider: undefined }) } : null,
    params.format ? { label: `Format: ${params.format}`, remove: href({ format: undefined }) } : null,
    params.api ? { label: "Real API endpoints", remove: href({ api: undefined }) } : null,
  ].filter((chip) => chip !== null);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-72">
          <SearchBar action="/tracker/datasets" query={params.q} label="Search datasets" placeholder="Search by title or id">
            {Object.entries(filters).map(([key, value]) => (key !== "q" && value ? <input key={key} type="hidden" name={key} value={value} /> : null))}
          </SearchBar>
        </div>
        <FiltersButton formats={formats} format={params.format} api={params.api} keep={{ q: params.q, status: params.status, provider: params.provider, category: params.category }} />
      </div>

      <nav aria-label="Filter by status" className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <LinkChip href={href({ status: undefined })} selected={!params.status}>All · {formatNumber(anyStatus.length)}</LinkChip>
        {TRACKER_STATUSES.map((status) => (
          <LinkChip key={status} href={href({ status })} selected={params.status === status}>
            {STATUS_LABELS[status]} · {formatNumber(statusCounts[status])}
          </LinkChip>
        ))}
      </nav>

      {active.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {active.map((chip) => (
            <Link key={chip.label} href={chip.remove} aria-label={`Remove ${chip.label}`} className="state-layer inline-flex h-8 max-w-full items-center gap-2 rounded-sm border border-outline pr-2 pl-3 type-label-large text-on-surface-variant">
              <span className="truncate">{chip.label}</span>
              <X size={16} className="shrink-0" />
            </Link>
          ))}
          <Link href={datasetsHref({ q: params.q, status: params.status })} className="state-layer rounded-full px-3 py-1.5 type-label-large text-primary">Clear filters</Link>
        </div>
      ) : null}

      <div className="mt-4">
        <DatasetTable
          rows={pageRows.map((row) => ({ row: serialise(row), href: pageHref({ dataset: row.id }) }))}
          selected={selected ? serialise(selected) : null}
          closeHref={pageHref()}
          canEdit={isAdmin(user)}
          repoUrl={process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/rxtech-lab/mcprouter"}
        />
      </div>
      {filtered.length ? <Pagination page={page} pageCount={pageCount} total={filtered.length} noun={filtered.length === 1 ? "dataset" : "datasets"} href={(next) => href({ page: next })} /> : null}
    </>
  );
}
