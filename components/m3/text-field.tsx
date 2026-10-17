import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

const field =
  "w-full rounded-xs border border-outline bg-transparent px-4 text-on-surface type-body-large outline-none placeholder:text-on-surface-variant/70 focus:border-2 focus:border-primary focus:px-[15px] disabled:opacity-40";

type FieldShellProps = { label: string; supporting?: ReactNode; error?: string | null; children: ReactNode; className?: string };

function FieldShell({ label, supporting, error, children, className }: FieldShellProps) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className={cn("type-body-small", error ? "text-error" : "text-on-surface-variant")}>{label}</span>
      {children}
      {error ? <span className="type-body-small text-error">{error}</span> : supporting ? <span className="type-body-small text-on-surface-variant">{supporting}</span> : null}
    </label>
  );
}

/** M3 outlined text field. */
export function TextField({ label, supporting, error, className, ...props }: ComponentProps<"input"> & Omit<FieldShellProps, "children">) {
  return (
    <FieldShell label={label} supporting={supporting} error={error} className={className}>
      <input className={cn(field, "h-14", error && "border-error")} aria-invalid={error ? true : undefined} {...props} />
    </FieldShell>
  );
}

export function TextArea({ label, supporting, error, className, ...props }: ComponentProps<"textarea"> & Omit<FieldShellProps, "children">) {
  return (
    <FieldShell label={label} supporting={supporting} error={error} className={className}>
      <textarea className={cn(field, "min-h-24 py-3")} {...props} />
    </FieldShell>
  );
}

/** Outlined select, native so it behaves well on every platform. */
export function SelectField({ label, supporting, error, className, children, ...props }: ComponentProps<"select"> & Omit<FieldShellProps, "children">) {
  return (
    <FieldShell label={label} supporting={supporting} error={error} className={className}>
      <select className={cn(field, "h-14 cursor-pointer appearance-auto bg-surface-container-high")} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}
