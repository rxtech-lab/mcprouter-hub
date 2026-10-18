import { defineCatalog, validateSpec, type Spec } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

/**
 * The components the agent can compose a UI from with `show_ui` (json-render). Shared by the tool, which
 * validates the spec, and the chat, which renders it with Material components. Display only: no actions.
 */

const tone = z.enum(["neutral", "primary", "tertiary", "success", "error"]).optional();

const components = {
  Stack: {
    props: z.object({ direction: z.enum(["vertical", "horizontal"]).optional(), gap: z.enum(["sm", "md", "lg"]).optional() }),
    description: "Lays its children out in a column (default) or a wrapping row",
  },
  Grid: {
    props: z.object({ columns: z.number().int().min(1).max(4).optional() }),
    description: "Equal-width columns (default 2) that collapse to one on phones; good for several Metrics",
  },
  Card: {
    props: z.object({ title: z.string().optional(), subtitle: z.string().optional() }),
    description: "A bordered section with an optional title, grouping its children",
  },
  Heading: {
    props: z.object({ text: z.string() }),
    description: "A section heading",
  },
  Text: {
    props: z.object({ text: z.string(), muted: z.boolean().optional() }),
    description: "A paragraph of plain text; muted for notes such as the source or update time",
  },
  Metric: {
    props: z.object({ label: z.string(), value: z.string(), unit: z.string().optional(), caption: z.string().optional() }),
    description: "One headline number, e.g. label Temperature, value 28, unit °C",
  },
  Badge: {
    props: z.object({ label: z.string(), tone }),
    description: "A short status label, e.g. a warning signal or Open",
  },
  Alert: {
    props: z.object({ title: z.string(), message: z.string().optional(), tone }),
    description: "A highlighted notice, e.g. a weather warning in force (tone error) or no warnings (tone success)",
  },
  Progress: {
    props: z.object({ label: z.string(), value: z.number().min(0).max(1), caption: z.string().optional() }),
    description: "A labelled bar for a share from 0 to 1, e.g. car park occupancy",
  },
  KeyValue: {
    props: z.object({ items: z.array(z.object({ label: z.string(), value: z.string() })).max(30) }),
    description: "Label and value pairs, for the details of one thing",
  },
  List: {
    props: z.object({ items: z.array(z.object({ title: z.string(), subtitle: z.string().optional(), trailing: z.string().optional() })).max(30) }),
    description: "Rows with a title, optional subtitle and trailing value, e.g. arrivals with their minutes",
  },
  Table: {
    props: z.object({ columns: z.array(z.string()).min(1).max(8), rows: z.array(z.array(z.string())).max(50) }),
    description: "A table of strings, one cell per column in each row; for comparing several things",
  },
  Link: {
    props: z.object({ label: z.string(), href: z.url({ protocol: /^https?$/ }) }),
    description: "A link that opens in a new tab, e.g. the official source",
  },
  Divider: {
    props: z.object({}),
    description: "A thin line between sections",
  },
};

export type UiComponent = keyof typeof components;

export const uiCatalog = defineCatalog(schema, { components, actions: {} });

const componentNames = Object.keys(components) as [UiComponent, ...UiComponent[]];

/** The spec the agent sends: json-render's flat element map, display props only. */
export const uiSpecSchema = z.object({
  root: z.string().min(1).describe("Key of the top element"),
  elements: z
    .record(
      z.string(),
      z.object({
        type: z.enum(componentNames),
        props: z.record(z.string(), z.unknown()).describe("The component's props, as listed in the tool description"),
        children: z.array(z.string()).optional().describe("Keys of child elements, for Stack, Grid and Card"),
      }),
    )
    .describe("Every element by key"),
});

export type UiSpec = z.infer<typeof uiSpecSchema>;

/** One line per component for the tool description: `Metric {label, value, unit?, caption?}: …`. */
export function describeComponents() {
  return Object.entries(components)
    .map(([name, { props, description }]) => {
      const fields = Object.entries(props.shape).map(([key, field]) => `${key}${(field as z.ZodType).safeParse(undefined).success ? "?" : ""}`);
      return `${name} {${fields.join(", ")}}: ${description}`;
    })
    .join("\n");
}

const MAX_ELEMENTS = 80;

/** Checks a spec's structure and every element's props; returns the problems, empty when it renders. */
export function checkUiSpec(spec: UiSpec): string[] {
  const problems: string[] = [];
  const keys = Object.keys(spec.elements);
  if (keys.length > MAX_ELEMENTS) problems.push(`At most ${MAX_ELEMENTS} elements.`);
  for (const [key, element] of Object.entries(spec.elements)) {
    const parsed = components[element.type].props.safeParse(element.props);
    if (!parsed.success) problems.push(`${key} (${element.type}): ${parsed.error.issues.map((issue) => `${issue.path.join(".") || "props"} ${issue.message}`).join("; ")}`);
  }
  const { issues } = validateSpec({ ...spec, elements: Object.fromEntries(keys.map((key) => [key, { children: [], ...spec.elements[key] }])) } as Spec);
  for (const issue of issues) if (issue.severity === "error") problems.push(issue.message);
  if (!problems.length && hasCycle(spec)) problems.push("An element contains itself; children must form a tree.");
  return problems;
}

/** Whether an element is its own ancestor or is reached twice, which would render forever or twice. */
function hasCycle(spec: UiSpec) {
  const seen = new Set<string>();
  const visit = (key: string): boolean => {
    if (seen.has(key)) return true;
    seen.add(key);
    return (spec.elements[key]?.children ?? []).some(visit);
  };
  return visit(spec.root);
}
