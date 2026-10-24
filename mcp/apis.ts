import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { API_ID, type ServiceSpec } from "./schema";

/**
 * The API tracker. `mcp/apis.yaml` lists every upstream API mcprouter serves
 * or plans to serve, each with a stable `API-NNNN` id. Status is never written
 * there: an API is implemented when a service YAML lists its id under `apis:`,
 * otherwise it's coming soon. Codegen turns the two into `generated/apis.json`
 * (read by the website) and `APIS.md` (the committed README).
 */

export const API_CATEGORIES = {
  transport: "Transport",
  weather: "Weather",
  environment: "Environment",
  health: "Health",
  finance: "Finance",
  places: "Places & addresses",
  government: "Government",
  commerce: "Commerce & industry",
  development: "Development",
  population: "Population",
  security: "Law & security",
  employment: "Employment & labour",
  welfare: "Social welfare",
  technology: "IT & broadcasting",
  recreation: "Recreation & culture",
  education: "Education",
  city: "City management",
  housing: "Housing",
  legislature: "Legislature",
  tourism: "Tourism",
  food: "Food",
  other: "Miscellaneous",
} as const;
export type ApiCategory = keyof typeof API_CATEGORIES;

export const API_STATUSES = { implemented: "Implemented", "coming-soon": "Coming soon" } as const;
export type ApiStatus = keyof typeof API_STATUSES;

/** `api`: the dataset has a live API resource on DATA.GOV.HK. `files`: only downloadable files (CSV, XLSX, …). */
export const API_KINDS = { api: "Live API", files: "Data files" } as const;
export type ApiKind = keyof typeof API_KINDS;

export const apiSpec = z
  .object({
    id: z.string().regex(API_ID, "API ids look like API-0012"),
    title: z.string().min(1),
    description: z.string().min(1),
    provider: z.string().min(1),
    category: z.enum(Object.keys(API_CATEGORIES) as [ApiCategory, ...ApiCategory[]]),
    /** DATA.GOV.HK (CKAN) dataset ids behind this API. */
    datasets: z.array(z.string().min(1)),
    kind: z.enum(Object.keys(API_KINDS) as [ApiKind, ...ApiKind[]]).default("api"),
    /** Developer docs, when there's a better page than the first dataset's. */
    docs: z.url({ protocol: /^https$/ }).optional(),
  })
  .strict()
  .refine((api) => api.datasets.length > 0 || api.docs !== undefined, {
    message: "APIs without DATA.GOV.HK datasets must provide a docs URL",
    path: ["docs"],
  });

export const apiRegistrySpec = z.object({ apis: z.array(apiSpec).min(1) }).strict();

export type ApiSpec = z.infer<typeof apiSpec>;

export type ApiEntry = ApiSpec & { docs: string; status: ApiStatus; services: string[] };

export type ApiTracker = {
  apis: ApiEntry[];
  counts: Record<ApiStatus, number>;
  /** The id the next new entry must use. */
  nextId: string;
};

export function formatApiId(number: number) {
  return `API-${String(number).padStart(4, "0")}`;
}

function idNumber(id: string) {
  return Number(id.slice(4));
}

/** Parse `mcp/apis.yaml`, join it with the services that implement each entry, and list every inconsistency. */
export function resolveApis(yaml: string, specs: ServiceSpec[]): { tracker: ApiTracker | null; problems: string[] } {
  const where = "mcp/apis.yaml";
  let raw: unknown;
  try {
    raw = parseYaml(yaml);
  } catch (error) {
    return { tracker: null, problems: [`${where}: invalid YAML: ${(error as Error).message}`] };
  }
  const parsed = apiRegistrySpec.safeParse(raw);
  if (!parsed.success) {
    return { tracker: null, problems: parsed.error.issues.map((issue) => `${where}: ${issue.path.join(".") || "(root)"}: ${issue.message}`) };
  }

  const problems: string[] = [];
  const entries = parsed.data.apis;
  // Strictly ascending ids rule out duplicates and make the next id obvious: append, never reuse or renumber.
  entries.forEach((entry, index) => {
    const previous = entries[index - 1];
    if (previous && idNumber(entry.id) <= idNumber(previous.id)) {
      problems.push(`${where}: ${entry.id} comes after ${previous.id}; ids must be unique and ascending (add new APIs at the end)`);
    }
  });

  const known = new Map(entries.map((entry) => [entry.id, entry]));
  const implementers = new Map<string, ServiceSpec[]>();
  for (const spec of specs) {
    const where = `mcp/services/${spec.id}/service.yaml`;
    if (spec.apis.length === 0) problems.push(`${where}: list the mcp/apis.yaml ids this service implements under apis:`);
    for (const id of spec.apis) {
      const entry = known.get(id);
      if (!entry) {
        problems.push(`${where}: apis: ${id} is not in mcp/apis.yaml`);
        continue;
      }
      (implementers.get(id) ?? implementers.set(id, []).get(id)!).push(spec);
      for (const dataset of entry.datasets) {
        if (!spec.datasets.includes(dataset)) problems.push(`${where}: implements ${id}, so datasets: must include ${dataset}`);
      }
    }
    for (const dataset of spec.datasets) {
      if (!spec.apis.some((id) => known.get(id)?.datasets.includes(dataset))) {
        problems.push(`${where}: dataset ${dataset} is not part of any API this service lists under apis:`);
      }
    }
  }
  if (problems.length) return { tracker: null, problems };

  const apis = entries.map((entry): ApiEntry => {
    const services = (implementers.get(entry.id) ?? []).map((spec) => spec.id);
    return {
      ...entry,
      docs: entry.docs ?? `https://data.gov.hk/en-data/dataset/${entry.datasets[0]}`,
      status: services.length ? "implemented" : "coming-soon",
      services,
    };
  });
  const counts: Record<ApiStatus, number> = { implemented: 0, "coming-soon": 0 };
  for (const api of apis) counts[api.status]++;
  return { tracker: { apis, counts, nextId: formatApiId(idNumber(entries.at(-1)!.id) + 1) }, problems };
}

function apisByKind(tracker: ApiTracker, kind: ApiKind) {
  return tracker.apis.filter((api) => api.kind === kind).length;
}

function cell(text: string) {
  return text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

/** `APIS.md`: the tracker as a README, grouped by category. */
export function renderApisMarkdown(tracker: ApiTracker, specs: ServiceSpec[]): string {
  const titles = new Map(specs.map((spec) => [spec.id, spec.title]));
  const total = tracker.apis.length;
  const lines = [
    "<!-- Generated by scripts/codegen.ts from mcp/apis.yaml and the service YAML files. Do not edit; run `bun run codegen`. -->",
    "",
    "# API tracker",
    "",
    `Every upstream API mcprouter serves as MCP tools, or plans to, including every DATA.GOV.HK dataset. **${tracker.counts.implemented} of ${total} implemented**, ${tracker.counts["coming-soon"]} coming soon.`,
    `${apisByKind(tracker, "api")} have a live API; ${apisByKind(tracker, "files")} only publish data files. New DATA.GOV.HK datasets are added with \`bun run apis:import\`.`,
    "The same list is on the website under Data sources → APIs (`/sources/apis`).",
    "",
    "## Implementing an API",
    "",
    "1. Pick a coming-soon id below (or add a new entry at the end of [`mcp/apis.yaml`](mcp/apis.yaml) with the next id,",
    `   currently \`${tracker.nextId}\`). Ids are permanent: never reuse or renumber one.`,
    "2. Build the service (see [Adding an MCP service](README.md#adding-an-mcp-service)) and list the id under `apis:` in its",
    "   `service.yaml`, with the API's datasets under `datasets:`.",
    "3. Run `bun run codegen`. The API flips to implemented here and on the website.",
    "4. Put the id in the pull request title, e.g. `feat(mcp): add AQHI (API-0031)`.",
    "",
  ];
  for (const [category, label] of Object.entries(API_CATEGORIES)) {
    const rows = tracker.apis.filter((api) => api.category === category);
    if (rows.length === 0) continue;
    lines.push(`## ${label}`, "", "| ID | API | Type | Provider | Status | Service |", "|---|---|---|---|---|---|");
    for (const api of rows) {
      const status = api.status === "implemented" ? "✅ Implemented" : "🕒 Coming soon";
      const services = api.services.map((id) => `[${cell(titles.get(id) ?? id)}](mcp/services/${id}/service.yaml)`).join(", ") || "—";
      const kind = api.kind === "api" ? "API" : "Files";
      lines.push(`| \`${api.id}\` | [${cell(api.title)}](${api.docs}) | ${kind} | ${cell(api.provider)} | ${status} | ${services} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
