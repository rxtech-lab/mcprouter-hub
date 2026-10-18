import type { ComponentProps, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "./cn";

/** M3 filter chip: a toggle that shows a check mark when selected. */
export function FilterChip({ selected, children, className, ...props }: ComponentProps<"button"> & { selected: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      className={cn(
        "state-layer inline-flex h-8 cursor-pointer items-center gap-2 rounded-sm px-3 type-label-large transition-[background-color,padding,border-color] duration-200 ease-emphasized",
        selected ? "bg-secondary-container pl-2 text-on-secondary-container" : "border border-outline text-on-surface-variant",
        className,
      )}
      {...props}
    >
      {selected ? <Check size={18} className="animate-[fade-through_200ms_cubic-bezier(0.2,0,0,1)_both]" /> : null}
      {children}
    </button>
  );
}

const tones = {
  neutral: "bg-surface-container-high text-on-surface-variant",
  primary: "bg-primary-container text-on-primary-container",
  tertiary: "bg-tertiary-container text-on-tertiary-container",
  error: "bg-error-container text-on-error-container",
  success: "bg-secondary-container text-on-secondary-container",
};

/** Non-interactive label chip. */
export function Badge({ tone = "neutral", icon, children, className }: { tone?: keyof typeof tones; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-sm px-2 type-label-medium whitespace-nowrap", tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
