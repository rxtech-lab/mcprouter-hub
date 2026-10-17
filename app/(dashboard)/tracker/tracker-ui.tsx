import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/m3/page-header";
import { Pagination } from "@/components/m3/pagination";
import { LinearProgress } from "@/components/m3/progress";
import { SearchBar } from "@/components/m3/search-bar";
import { listHref } from "@/app/sources/params";
import { formatNumber } from "@/lib/format";
import { percent, type Progress } from "@/lib/tracker";

export function NotSynced() {
  return (
    <EmptyState title="The catalogue hasn't been synced yet">
      Run <code className="font-mono">bun run catalog:sync</code>, or wait for the daily cron, to load the DATA.GOV.HK catalogue.
    </EmptyState>
  );
}

export function ProgressRow({ progress, href }: { progress: Progress; href: string }) {
  return (
    <li>
      <Link href={href} className="state-layer -mx-2 block rounded-xs px-2 py-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate type-body-medium">{progress.label}</span>
          <span className="type-label-medium whitespace-nowrap text-on-surface-variant tabular-nums">
            {progress.converted} / {progress.total}
          </span>
        </div>
        <LinearProgress value={progress.total ? progress.converted / progress.total : 0} className="mt-1" label={`${progress.label} converted`} />
      </Link>
    </li>
  );
}

const GROUP_PAGE_SIZE = 24;

/** Searchable, paginated grid of category or provider progress cards; each opens the filtered dataset list. */
export function GroupGrid({ groups, path, query, page, noun, placeholder, hrefFor }: {
  groups: Progress[];
  path: string;
  query?: string;
  page: number;
  noun: [string, string];
  placeholder: string;
  hrefFor: (group: Progress) => string;
}) {
  const words = query?.toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  const filtered = groups.filter((group) => words.every((word) => `${group.label} ${group.key}`.toLowerCase().includes(word)));
  const pageCount = Math.max(1, Math.ceil(filtered.length / GROUP_PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * GROUP_PAGE_SIZE, current * GROUP_PAGE_SIZE);

  return (
    <>
      <SearchBar action={path} query={query} label={`Search ${noun[1]}`} placeholder={placeholder} />
      {visible.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={`No ${noun[1]} match “${query}”`}>Try a shorter word.</EmptyState>
        </div>
      ) : (
        <>
          <ul className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((group) => (
              <li key={group.key}>
                <Link href={hrefFor(group)} className="state-layer flex h-full flex-col gap-3 rounded-lg border border-outline-variant p-4 text-on-surface">
                  <span className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 type-title-medium">{group.label}</span>
                    <ChevronRight size={20} className="shrink-0 text-on-surface-variant" />
                  </span>
                  <span className="mt-auto flex flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-2 type-body-small text-on-surface-variant tabular-nums">
                      <span>{formatNumber(group.converted)} of {formatNumber(group.total)} converted</span>
                      <span className="type-label-large text-primary">{percent(group.converted, group.total)}</span>
                    </span>
                    <LinearProgress value={group.total ? group.converted / group.total : 0} label={`${group.label} converted`} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={current} pageCount={pageCount} total={filtered.length} noun={filtered.length === 1 ? noun[0] : noun[1]} href={(next) => listHref(path, { q: query, page: next })} />
        </>
      )}
    </>
  );
}
