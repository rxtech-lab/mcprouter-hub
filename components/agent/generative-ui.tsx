"use client";

import { JSONUIProvider, Renderer, defineRegistry } from "@json-render/react";
import type { Spec } from "@json-render/core";
import { useMemo } from "react";
import { CircleAlert, CircleCheck, ExternalLink, Info } from "lucide-react";
import { Badge } from "@/components/m3/chip";
import { cn } from "@/components/m3/cn";
import { LinearProgress } from "@/components/m3/progress";
import { uiCatalog, type UiSpec } from "@/lib/agent/ui-catalog";

/** The `show_ui` components, drawn with this site's Material tokens. */

const gaps = { sm: "gap-2", md: "gap-3", lg: "gap-4" };
const gridColumns = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 md:grid-cols-4" };
const alertTones = {
  neutral: "bg-surface-container-high text-on-surface",
  primary: "bg-primary-container text-on-primary-container",
  tertiary: "bg-tertiary-container text-on-tertiary-container",
  success: "bg-secondary-container text-on-secondary-container",
  error: "bg-error-container text-on-error-container",
};

const { registry } = defineRegistry(uiCatalog, {
  components: {
    Stack: ({ props, children }) => (
      <div className={cn("flex", props.direction === "horizontal" ? "flex-row flex-wrap items-center" : "flex-col", gaps[props.gap ?? "md"])}>{children}</div>
    ),
    Grid: ({ props, children }) => <div className={cn("grid grid-cols-1 gap-3", gridColumns[(props.columns ?? 2) as keyof typeof gridColumns])}>{children}</div>,
    Card: ({ props, children }) => (
      <section className="flex flex-col gap-3 rounded-md border border-outline-variant bg-surface p-4">
        {props.title || props.subtitle ? (
          <header>
            {props.title ? <h3 className="type-title-medium text-on-surface">{props.title}</h3> : null}
            {props.subtitle ? <p className="type-body-small text-on-surface-variant">{props.subtitle}</p> : null}
          </header>
        ) : null}
        {children}
      </section>
    ),
    Heading: ({ props }) => <h3 className="type-title-medium text-on-surface">{props.text}</h3>,
    Text: ({ props }) => <p className={cn("type-body-medium", props.muted ? "text-on-surface-variant" : "text-on-surface")}>{props.text}</p>,
    Metric: ({ props }) => (
      <div className="flex flex-col gap-0.5 rounded-md bg-surface-container-highest px-4 py-3">
        <span className="type-label-large text-on-surface-variant">{props.label}</span>
        <span className="type-headline-medium text-on-surface tabular-nums">
          {props.value}
          {props.unit ? <span className="ml-0.5 type-title-medium text-on-surface-variant">{props.unit}</span> : null}
        </span>
        {props.caption ? <span className="type-body-small text-on-surface-variant">{props.caption}</span> : null}
      </div>
    ),
    Badge: ({ props }) => <Badge tone={props.tone ?? "neutral"}>{props.label}</Badge>,
    Alert: ({ props }) => {
      const tone = props.tone ?? "neutral";
      const Icon = tone === "error" ? CircleAlert : tone === "success" ? CircleCheck : Info;
      return (
        <div role={tone === "error" ? "alert" : undefined} className={cn("flex gap-3 rounded-md px-4 py-3", alertTones[tone])}>
          <Icon size={20} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="type-title-small">{props.title}</p>
            {props.message ? <p className="type-body-medium">{props.message}</p> : null}
          </div>
        </div>
      );
    },
    Progress: ({ props }) => (
      <div className="flex flex-col gap-1.5">
        <span className="flex justify-between gap-2 type-label-large text-on-surface">
          {props.label}
          <span className="tabular-nums text-on-surface-variant">{Math.round(props.value * 100)}%</span>
        </span>
        <LinearProgress value={props.value} label={props.label} />
        {props.caption ? <span className="type-body-small text-on-surface-variant">{props.caption}</span> : null}
      </div>
    ),
    KeyValue: ({ props }) => (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 type-body-medium">
        {props.items.map((item, index) => (
          <div key={index} className="contents">
            <dt className="text-on-surface-variant">{item.label}</dt>
            <dd className="text-on-surface">{item.value}</dd>
          </div>
        ))}
      </dl>
    ),
    List: ({ props }) => (
      <ul className="flex flex-col divide-y divide-outline-variant">
        {props.items.map((item, index) => (
          <li key={index} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="type-body-large text-on-surface">{item.title}</p>
              {item.subtitle ? <p className="type-body-small text-on-surface-variant">{item.subtitle}</p> : null}
            </div>
            {item.trailing ? <span className="shrink-0 type-label-large text-primary tabular-nums">{item.trailing}</span> : null}
          </li>
        ))}
      </ul>
    ),
    Table: ({ props }) => (
      <div className="overflow-x-auto rounded-md border border-outline-variant">
        <table className="w-full type-body-medium">
          <thead className="bg-surface-container-high">
            <tr>
              {props.columns.map((column, index) => (
                <th key={index} className="px-3 py-2 text-left type-label-large text-on-surface-variant">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {props.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {props.columns.map((_, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2 text-on-surface tabular-nums">{row[cellIndex] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
    Link: ({ props }) => (
      <a href={props.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 self-start type-label-large text-primary hover:underline">
        {props.label} <ExternalLink size={14} />
      </a>
    ),
    Divider: () => <hr className="border-outline-variant" />,
  },
});

/** A UI the agent composed with `show_ui`, from its json-render spec. */
export function GenerativeUi({ spec }: { spec: UiSpec }) {
  // The renderer expects every element to list its children.
  const full = useMemo(
    () => ({ root: spec.root, elements: Object.fromEntries(Object.entries(spec.elements).map(([key, element]) => [key, { children: [], ...element }])) }) as Spec,
    [spec],
  );
  return (
    <div className="my-2 flex flex-col gap-3 animate-message-in" data-testid="generative-ui">
      <JSONUIProvider registry={registry}>
        <Renderer spec={full} registry={registry} />
      </JSONUIProvider>
    </div>
  );
}
