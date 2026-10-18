// DATA.GOV.HK catalogue chat cards: dataset search and dataset details, as still pictures.
import { blocks, card, fmt, langOf, type Card, type CardBuilder, type CardInput, type Row } from "../../apps/card";

const base = { accent: "#5b3fa0", badge: "DATA" };

function search({ input, data = {} }: CardInput): Card {
  const results: Row[] = data.results ?? [];
  const english = langOf(input) === "en";
  const filters = [input?.query && `“${input.query}”`, input?.provider, input?.category].filter(Boolean).join(" · ");
  return {
    ...base,
    title: `Datasets${filters ? ` · ${filters}` : ""}`,
    subtitle: fmt.plural(results.length, "result"),
    blocks: blocks(
      data.note && card.notice(data.note, "info"),
      results.length
        ? results.map((dataset) =>
            card.row({
              title: english ? dataset.title : dataset.titleTc || dataset.title,
              subtitle: [dataset.provider, (dataset.formats ?? []).slice(0, 4).join(", ")].filter(Boolean).join(" · "),
              trailing: (dataset.mcprouterServices ?? []).length ? [{ text: "Live tool", tone: "success" }] : dataset.hasApi ? [{ text: "API", tone: "info" }] : undefined,
            }),
          )
        : card.text("No datasets match.", true),
    ),
  };
}

function details({ data = {} }: CardInput): Card {
  const resources: Row[] = data.resources ?? [];
  const notes = String(data.notes ?? "");
  return {
    ...base,
    title: data.title || data.name,
    subtitle: data.organization ? data.organization.title || data.organization.name : null,
    blocks: blocks(
      notes && card.text(notes.length > 400 ? `${notes.slice(0, 400)}…` : notes),
      card.stats([
        data.update_frequency && { label: "Updates", value: String(data.update_frequency) },
        data.metadata_modified && { label: "Modified", value: fmt.day(data.metadata_modified, { year: "numeric" }) },
      ]),
      resources.length > 0 && card.section(fmt.plural(resources.length, "resource")),
      resources.map((resource) => card.row({ leading: { text: resource.format || "file", tone: "info" }, title: resource.name || resource.url })),
    ),
  };
}

const builders: Record<string, CardBuilder> = { datagovhk_search_datasets: search, datagovhk_dataset_details: details };

export const buildCard: CardBuilder = (result) => builders[result.tool]?.(result) ?? null;
