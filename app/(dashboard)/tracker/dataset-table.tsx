"use client";

import { ExternalLink, Plug } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/m3/button";
import { Card } from "@/components/m3/card";
import { Badge } from "@/components/m3/chip";
import { Dialog } from "@/components/m3/dialog";
import { SelectField, TextArea } from "@/components/m3/text-field";
import { useActionRunner } from "@/components/use-action-runner";
import { humanise, type TrackerRow } from "@/lib/tracker";
import { setDatasetStatus } from "./actions";
import { StatusBadge } from "./status-badge";

export type Row = Omit<TrackerRow, "syncedAt"> & { syncedAt: string | null };

/** CKAN lists "API" as a format too; the API badge already says so. */
function fileFormats(row: Row) {
  return row.isApi ? row.formats.filter((format) => format !== "API") : row.formats;
}

type Props = {
  rows: { row: Row; href: string }[];
  /** The dataset named by `?dataset=` in the URL, shown in a dialog. */
  selected: Row | null;
  closeHref: string;
  canEdit: boolean;
  repoUrl: string;
};

export function DatasetTable({ rows, selected, closeHref, canEdit, repoUrl }: Props) {
  const router = useRouter();
  const close = () => router.replace(closeHref, { scroll: false });
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead className="type-label-medium text-on-surface-variant">
            <tr className="border-b border-outline-variant">
              <th className="px-4 py-3 font-medium">Dataset</th>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Formats</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="type-body-medium">
            {rows.map(({ row, href }) => (
              <tr
                key={row.id}
                onClick={() => router.push(href, { scroll: false })}
                className="cursor-pointer border-b border-outline-variant last:border-0 hover:bg-surface-container-low focus-within:bg-surface-container-low"
              >
                <td className="max-w-md px-4 py-2">
                  <Link href={href} scroll={false} onClick={(event) => event.stopPropagation()} className="line-clamp-1 outline-none">
                    {row.titleEn}
                  </Link>
                  <span className="block truncate font-mono text-xs text-on-surface-variant">{row.id}</span>
                </td>
                <td className="max-w-56 truncate px-4 py-2 text-on-surface-variant">{row.organizationTitle ?? row.organization ?? "—"}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {row.isApi ? <Badge tone="primary" icon={<Plug size={12} />}>API</Badge> : null}
                    {fileFormats(row).slice(0, 3).map((format) => <Badge key={format}>{format}</Badge>)}
                    {fileFormats(row).length > 3 ? <Badge>+{fileFormats(row).length - 3}</Badge> : null}
                  </div>
                </td>
                <td className="px-4 py-2"><StatusBadge status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="p-6 text-center type-body-medium text-on-surface-variant">No datasets match these filters.</p> : null}
      {selected ? <DatasetDialog key={selected.id} row={selected} canEdit={canEdit} repoUrl={repoUrl} onClose={close} /> : null}
    </Card>
  );
}

function DatasetDialog({ row, canEdit, repoUrl, onClose }: { row: Row; canEdit: boolean; repoUrl: string; onClose: () => void }) {
  const manual = row.status === "converted" || row.status === "not_started" ? "" : row.status;
  const [status, setStatus] = useState<string>(manual);
  const [priority, setPriority] = useState(String(row.priority));
  const [reason, setReason] = useState(row.reason ?? "");
  const { pending, run } = useActionRunner();
  const editable = canEdit && row.status !== "converted";
  const dirty = status !== manual || priority !== String(row.priority) || reason !== (row.reason ?? "");

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title={row.titleEn}
      description={row.titleTc ?? undefined}
      className="w-[min(640px,calc(100vw-32px))]"
      actions={
        editable ? (
          <>
            <Button variant="text" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button
              disabled={pending || !dirty || (status === "skipped" && !reason.trim())}
              onClick={() =>
                run(
                  () => setDatasetStatus({ datasetId: row.id, status: (status || null) as "planned" | "in_progress" | "skipped" | null, reason, priority: Number(priority) }),
                  { progress: "Saving status…", success: "Status saved" },
                  onClose,
                )
              }
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </>
        ) : (
          <Button variant="text" onClick={onClose}>Close</Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={row.status} />
          {row.isApi ? <Badge tone="primary" icon={<Plug size={12} />}>Real API endpoint</Badge> : null}
          {fileFormats(row).map((format) => <Badge key={format}>{format}</Badge>)}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 type-body-medium">
          <dt className="text-on-surface-variant">Id</dt>
          <dd className="font-mono text-sm break-all">{row.id}</dd>
          <dt className="text-on-surface-variant">Provider</dt>
          <dd>{row.organizationTitle ?? row.organization ?? "—"}</dd>
          <dt className="text-on-surface-variant">Categories</dt>
          <dd>{row.groups.map(humanise).join(", ") || "—"}</dd>
          {row.services.length ? (
            <>
              <dt className="text-on-surface-variant">Services</dt>
              <dd className="flex flex-col gap-1">
                {row.services.map((service) => (
                  <a key={service} className="inline-flex items-center gap-1 text-primary underline" href={`${repoUrl}/blob/main/mcp/services/${service}/service.yaml`} target="_blank" rel="noreferrer">
                    mcp/services/{service}/service.yaml <ExternalLink size={14} />
                  </a>
                ))}
              </dd>
            </>
          ) : null}
          {row.reason && !editable ? (
            <>
              <dt className="text-on-surface-variant">Reason</dt>
              <dd>{row.reason}</dd>
            </>
          ) : null}
        </dl>
        <a className="inline-flex items-center gap-1 self-start type-label-large text-primary" href={`https://data.gov.hk/en-data/dataset/${row.id}`} target="_blank" rel="noreferrer">
          Open on DATA.GOV.HK <ExternalLink size={14} />
        </a>
        {editable ? (
          <div className="grid gap-4 border-t border-outline-variant pt-4 sm:grid-cols-2">
            <SelectField label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Not started</option>
              <option value="planned">Planned</option>
              <option value="in_progress">In progress</option>
              <option value="skipped">Skipped</option>
            </SelectField>
            <SelectField label="Priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="0">None</option>
              <option value="1">Low</option>
              <option value="2">Medium</option>
              <option value="3">High</option>
            </SelectField>
            <TextArea
              className="sm:col-span-2"
              label={status === "skipped" ? "Reason (required)" : "Notes"}
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder={status === "skipped" ? "e.g. PDF only, no machine-readable data" : undefined}
            />
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
