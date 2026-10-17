import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

const variants = {
  elevated: "bg-surface-container-low shadow-elevation-1",
  filled: "bg-surface-container-highest",
  outlined: "border border-outline-variant bg-surface",
};

export function Card({ variant = "outlined", className, ...props }: ComponentProps<"section"> & { variant?: keyof typeof variants }) {
  return <section className={cn("rounded-md p-4", variants[variant], className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("type-title-medium text-on-surface", className)} {...props} />;
}

export function StatCard({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon?: ReactNode }) {
  return (
    <Card variant="filled" className="flex flex-col gap-1">
      <span className="flex items-center justify-between gap-2 type-label-large text-on-surface-variant">
        {label}
        {icon ? <span className="flex size-9 items-center justify-center rounded-full bg-surface-container-lowest text-primary">{icon}</span> : null}
      </span>
      <span className="type-headline-medium text-on-surface tabular-nums">{value}</span>
      {detail ? <span className="type-body-small text-on-surface-variant">{detail}</span> : null}
    </Card>
  );
}
