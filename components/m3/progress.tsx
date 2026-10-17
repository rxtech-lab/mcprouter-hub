import { cn } from "./cn";

export function LinearProgress({ value, className, label }: { value: number; className?: string; label?: string }) {
  const percent = Math.max(0, Math.min(100, value * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      className={cn("flex h-1 w-full gap-1 overflow-hidden rounded-full", className)}
    >
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      <div className="h-full flex-1 rounded-full bg-secondary-container" />
    </div>
  );
}
