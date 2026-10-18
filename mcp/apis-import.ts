import { parse as parseYaml, stringify } from "yaml";
import { formatApiId, type ApiCategory } from "./apis";

/**
 * Turns DATA.GOV.HK catalogue packages into new `mcp/apis.yaml` entries, so
 * the tracker covers every dataset. Only datasets no entry lists yet are
 * added, at the end with the next ids; existing entries are never touched.
 */

export type CatalogPackage = {
  name: string;
  title: string;
  notes?: string | null;
  organization?: { title: string } | null;
  groups?: Array<{ name: string }>;
  resources?: Array<{ is_api?: string }>;
};

/** DATA.GOV.HK group → tracker category. */
const GROUP_CATEGORIES: Record<string, ApiCategory> = {
  "city-management": "city",
  "climate-and-weather": "weather",
  "commerce-and-industry": "commerce",
  development: "development",
  education: "education",
  "employment-and-labour": "employment",
  environment: "environment",
  finance: "finance",
  food: "food",
  health: "health",
  housing: "housing",
  "information-technology-and-broadcasting": "technology",
  "law-and-security": "security",
  legislature: "legislature",
  miscellaneous: "other",
  population: "population",
  "recreation-and-culture": "recreation",
  "social-welfare": "welfare",
  tourism: "tourism",
  transport: "transport",
};

export function categoryFor(groups: Array<{ name: string }> = []): ApiCategory {
  for (const group of groups) if (GROUP_CATEGORIES[group.name]) return GROUP_CATEGORIES[group.name];
  return "other";
}

function oneLine(text: string) {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** The dataset's notes, cut at a sentence (or word) near 280 characters; the title when there are none. */
export function describe(pkg: CatalogPackage) {
  const notes = oneLine(pkg.notes ?? "");
  if (!notes) return oneLine(pkg.title);
  if (notes.length <= 280) return notes;
  const cut = notes.slice(0, 280);
  const sentence = cut.lastIndexOf(". ");
  return sentence > 120 ? cut.slice(0, sentence + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/** The YAML to append to `mcp/apis.yaml` for every package not listed yet, and how many entries that is. */
export function importApis(yaml: string, packages: CatalogPackage[]): { text: string; added: string[] } {
  const entries = (parseYaml(yaml) as { apis: Array<{ id: string; datasets: string[] }> }).apis;
  const listed = new Set(entries.flatMap((entry) => entry.datasets));
  let next = Number(entries.at(-1)!.id.slice(4)) + 1;

  const fresh = packages
    .filter((pkg) => !listed.has(pkg.name))
    .sort((a, b) => (a.organization?.title ?? "").localeCompare(b.organization?.title ?? "") || a.name.localeCompare(b.name));
  const added: string[] = [];
  const blocks = fresh.map((pkg) => {
    const id = formatApiId(next++);
    added.push(id);
    const entry = {
      id,
      title: oneLine(pkg.title) || pkg.name,
      description: describe(pkg),
      provider: pkg.organization?.title?.trim() || "DATA.GOV.HK",
      category: categoryFor(pkg.groups),
      datasets: [pkg.name],
      ...((pkg.resources ?? []).some((resource) => resource.is_api === "Y") ? {} : { kind: "files" }),
    };
    const body = stringify([entry], { lineWidth: 0, flowCollectionPadding: false }).trimEnd();
    return `\n${body.replace(/^/gm, "  ")}\n`;
  });
  return { text: blocks.join(""), added };
}
