import { formatNumber } from "@/lib/format";

/**
 * Single-series magnitude charts in the primary colour: thin bars with 4px
 * rounded data ends on a recessive baseline, a hover tooltip per bar, no
 * legend (the card title names the series).
 */

export function DailyBarChart({ data, label }: { data: Array<{ day: string; value: number }>; label: string }) {
  const max = Math.max(1, ...data.map((point) => point.value));
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const tickEvery = Math.ceil(data.length / 6);
  return (
    <figure aria-label={`${label}: ${formatNumber(total)} in total`}>
      <div className="relative flex h-44 items-end gap-[2px] border-b border-outline-variant">
        <span className="pointer-events-none absolute top-0 left-0 type-label-small text-on-surface-variant tabular-nums">{formatNumber(max)}</span>
        {data.map((point) => (
          <div key={point.day} className="group relative flex h-full flex-1 items-end" tabIndex={0} aria-label={`${point.day}: ${formatNumber(point.value)} calls`}>
            <div
              className="w-full rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80"
              style={{ height: point.value ? `${Math.max(2, (point.value / max) * 100)}%` : 0 }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-xs bg-inverse-surface px-2 py-1 whitespace-nowrap type-body-small text-inverse-on-surface shadow-elevation-2 group-hover:block group-focus:block">
              {point.day} · {formatNumber(point.value)} calls
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px]">
        {data.map((point, index) => (
          <span key={point.day} className="flex flex-1 justify-center type-label-small whitespace-nowrap text-on-surface-variant">
            {index % tickEvery === 0 ? point.day.slice(5) : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}

export function HorizontalBars({ rows, empty }: { rows: Array<{ label: string; detail?: string; value: number }>; empty: string }) {
  if (rows.length === 0) return <p className="py-6 text-center type-body-medium text-on-surface-variant">{empty}</p>;
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={`${row.label}-${row.detail}`} className="group" title={`${row.label}: ${formatNumber(row.value)}`}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-mono text-[13px] text-on-surface">{row.label}</span>
            <span className="type-label-medium text-on-surface-variant tabular-nums">{formatNumber(row.value)}</span>
          </div>
          {row.detail ? <span className="type-body-small text-on-surface-variant">{row.detail}</span> : null}
          <div className="mt-1 h-2 rounded-r-[4px] bg-primary group-hover:opacity-80" style={{ width: `${Math.max(1, (row.value / max) * 100)}%` }} />
        </li>
      ))}
    </ul>
  );
}
