import type { ReactNode } from "react";

/** Top app bar for a dashboard page: title, supporting text and trailing actions. */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="min-w-0">
        <h1 className="type-headline-medium text-on-surface">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl type-body-medium text-on-surface-variant">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-outline-variant px-6 py-12 text-center">
      {icon ? <div className="text-on-surface-variant">{icon}</div> : null}
      <p className="type-title-medium">{title}</p>
      {children ? <div className="max-w-md type-body-medium text-on-surface-variant">{children}</div> : null}
    </div>
  );
}
