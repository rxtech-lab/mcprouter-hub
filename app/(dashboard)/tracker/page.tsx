import { ChevronRight, Plug } from "lucide-react";
import Link from "next/link";
import { Card, CardTitle } from "@/components/m3/card";
import { LinearProgress } from "@/components/m3/progress";
import { requirePageUser } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { percent, STATUS_LABELS, summarise, TRACKER_STATUSES } from "@/lib/tracker";
import { loadTrackerRows } from "@/lib/tracker-data";
import { datasetsHref } from "./params";
import { STATUS_STYLE } from "./status-badge";
import { NotSynced, ProgressRow } from "./tracker-ui";

export const metadata = { title: "Tracker" };

const TOP = 6;

function StatusTile({ href, label, value, icon }: { href: string; label: string; value: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="state-layer flex items-center gap-3 rounded-md border border-outline-variant p-3 text-on-surface">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-primary">{icon}</span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate type-label-large text-on-surface-variant">{label}</span>
        <span className="type-title-large tabular-nums">{value}</span>
      </span>
    </Link>
  );
}

export default async function TrackerPage() {
  await requirePageUser();
  const rows = await loadTrackerRows();
  if (rows.length === 0) return <NotSynced />;

  const summary = summarise(rows);
  const unsynced = rows.filter((row) => !row.syncedAt).length;

  return (
    <>
      <Card variant="filled">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <span className="type-label-large text-on-surface-variant">Datasets converted</span>
            <p className="type-display-small tabular-nums">
              {formatNumber(summary.overall.converted)}
              <span className="type-title-large text-on-surface-variant"> / {formatNumber(summary.overall.total)}</span>
            </p>
          </div>
          <span className="type-headline-small text-primary">{percent(summary.overall.converted, summary.overall.total)}</span>
        </div>
        <LinearProgress value={summary.overall.converted / summary.overall.total} className="mt-3 h-2" label="Overall conversion" />
        {unsynced ? <p className="mt-2 type-body-small text-on-surface-variant">{formatNumber(unsynced)} datasets are still waiting for their first metadata sync.</p> : null}
      </Card>

      <section className="mt-6">
        <h2 className="mb-3 type-title-medium">By status</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {TRACKER_STATUSES.map((status) => (
            <StatusTile key={status} href={datasetsHref({ status })} label={STATUS_LABELS[status]} value={formatNumber(summary.overall.counts[status])} icon={STATUS_STYLE[status].icon(18)} />
          ))}
          <StatusTile href={datasetsHref({ api: "1" })} label="Real APIs converted" value={`${summary.apiOnly.converted} / ${summary.apiOnly.total}`} icon={<Plug size={18} />} />
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {[
          { title: "Top categories", groups: summary.byCategory, all: "/tracker/categories", noun: "categories", key: "category" as const },
          { title: "Top providers", groups: summary.byProvider, all: "/tracker/providers", noun: "providers", key: "provider" as const },
        ].map((section) => (
          <Card key={section.title} className="flex flex-col">
            <CardTitle className="mb-2">{section.title}</CardTitle>
            <ul className="flex flex-col">
              {section.groups.slice(0, TOP).map((group) => <ProgressRow key={group.key} progress={group} href={datasetsHref({ [section.key]: group.key })} />)}
            </ul>
            <Link href={section.all} className="state-layer mt-3 -mx-2 inline-flex items-center gap-1 self-start rounded-full px-3 py-2 type-label-large text-primary">
              All {section.groups.length} {section.noun} <ChevronRight size={16} />
            </Link>
          </Card>
        ))}
      </div>
    </>
  );
}
