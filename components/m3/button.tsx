import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "filled" | "tonal" | "outlined" | "text" | "elevated" | "danger";

const variants: Record<ButtonVariant, string> = {
  filled: "bg-primary text-on-primary hover:shadow-elevation-1",
  tonal: "bg-secondary-container text-on-secondary-container hover:shadow-elevation-1",
  outlined: "border border-outline text-primary",
  text: "text-primary px-3",
  elevated: "bg-surface-container-low text-primary shadow-elevation-1 hover:shadow-elevation-2",
  danger: "bg-error text-on-error hover:shadow-elevation-1",
};

export function buttonClasses(variant: ButtonVariant = "filled", className?: string) {
  return cn(
    "state-layer inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-6 type-label-large transition-shadow select-none",
    "disabled:pointer-events-none disabled:opacity-40",
    variants[variant],
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; icon?: ReactNode };

export function Button({ variant = "filled", icon, className, children, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, cn(icon ? "pl-4" : undefined, className))} {...props}>
      {icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; icon?: ReactNode };

export function ButtonLink({ variant = "filled", icon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, cn(icon ? "pl-4" : undefined, className))} {...props}>
      {icon}
      {children}
    </Link>
  );
}

const iconVariants = {
  standard: "text-on-surface-variant",
  filled: "bg-primary text-on-primary disabled:bg-on-surface/12 disabled:text-on-surface/38 disabled:opacity-100",
  tonal: "bg-secondary-container text-on-secondary-container",
};

export function IconButton({
  className,
  label,
  children,
  type = "button",
  variant = "standard",
  ...props
}: ComponentProps<"button"> & { label: string; variant?: keyof typeof iconVariants }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "state-layer inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full disabled:cursor-default disabled:opacity-40",
        iconVariants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
