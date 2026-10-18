// DATA.GOV.HK catalogue MCP App: dataset search, dataset details, the historical archive and CSV queries.
import { app, fmt, h, mount, ui, type Content, type Row, type View } from "../../apps/runtime";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function search(view: View) {
  const data: Row = view.data ?? {};
  const results: Row[] = data.results ?? [];
  const filters = [view.input.query && `“${view.input.query}”`, view.input.provider, view.input.category].filter(Boolean).join(" · ");
  return [
    ui.header({ badge: "DATA", title: `Datasets${filters ? ` · ${filters}` : ""}`, subtitle: plural(results.length, "result") }),
    data.note ? ui.notice(data.note, "info") : null,
    results.length
      ? ui.more(
          results.map((dataset) => {
            const live: string[] = dataset.mcprouterServices ?? [];
            return h(
              "div",
              { class: "row", style: { flexDirection: "column", alignItems: "stretch", gap: "6px" } },
              h(
                "span",
                { class: "row-text" },
                h("span", { class: "row-title" }, app.lang === "en" ? dataset.title : dataset.titleTc || dataset.title),
                h("span", { class: "row-subtitle" }, dataset.provider),
              ),
              h(
                "div",
                { class: "chips" },
                live.length ? ui.chip(`Live tool: ${live.join(", ")}`, "success") : null,
                dataset.hasApi ? ui.chip("API", "info") : null,
                (dataset.formats ?? []).slice(0, 5).map((format: string) => ui.chip(format)),
              ),
              h(
                "div",
                { class: "actions" },
                ui.askButton("Details", `Show the details and resources of the DATA.GOV.HK dataset ${dataset.id}`),
                ui.linkButton("Open", dataset.url),
              ),
            );
          }),
          6,
          "datasets",
        )
      : ui.empty("No datasets match."),
  ];
}

function details(view: View) {
  const data: Row = view.data ?? {};
  const resources: Row[] = data.resources ?? [];
  const groups = (data.groups ?? []).map((group: Row) => group.title || group.name);
  const notes = String(data.notes ?? "");
  return [
    ui.header({ badge: "DATA", title: data.title || data.name, subtitle: data.organization ? data.organization.title || data.organization.name : null }),
    notes ? h("p", { class: "prose" }, notes.length > 600 ? `${notes.slice(0, 600)}…` : notes) : null,
    ui.kv([
      ["Dataset id", h("span", { class: "mono" }, data.name)],
      ["Updates", data.update_frequency],
      ["Modified", data.metadata_modified ? fmt.day(data.metadata_modified, { year: "numeric" }) : null],
      ["Categories", groups.join(", ")],
    ]),
    resources.length
      ? ui.section(
          plural(resources.length, "resource"),
          ui.more(
            resources.map((resource) =>
              ui.row({
                leading: ui.chip(resource.format || "file", "info"),
                title: resource.name || resource.url,
                subtitle: resource.description ? String(resource.description).slice(0, 140) : null,
                trailing: ui.linkButton("", resource.url),
              }),
            ),
            6,
            "resources",
          ),
        )
      : null,
  ];
}

function archiveFiles(view: View) {
  const files: Row[] = view.data ?? [];
  return [
    ui.header({ badge: "ARC", title: "Archived files", subtitle: `${view.input.start} – ${view.input.end}` }),
    files.length
      ? ui.more(
          files.map((file) =>
            ui.row({
              leading: ui.chip(file.format || "file"),
              title: file["resource-name-en"] || file["dataset-name-en"] || file.url,
              subtitle: [file["dataset-name-en"], file["provider-name-en"]].filter(Boolean).join(" · "),
              trailing: ui.askButton("Versions", `List archived versions of ${file.url} between ${view.input.start} and ${view.input.end}`),
            }),
          ),
          8,
          "files",
        )
      : ui.empty("No archived files match."),
  ];
}

function versions(view: View) {
  const data: Row = view.data ?? {};
  const timestamps: unknown[] = data.timestamps ?? (Array.isArray(data) ? data : []);
  return [
    ui.header({ badge: "ARC", title: "Archived versions", subtitle: plural(timestamps.length, "version") }),
    timestamps.length ? h("div", { class: "chips" }, timestamps.slice(0, 80).map((stamp) => ui.chip(String(stamp)))) : ui.generic(data),
  ];
}

function file(view: View) {
  const data: Row = view.data ?? {};
  return [
    ui.header({ badge: "ARC", title: "Archived file", subtitle: view.input.time }),
    h("pre", { class: "kv mono", style: { display: "block", maxHeight: "320px", overflow: "auto", whiteSpace: "pre-wrap" } }, String(data.content ?? "")),
    data.omittedCharacters ? ui.footer(view, `${data.omittedCharacters} more characters not shown`) : null,
  ];
}

function csv(view: View) {
  const data: Row = view.data ?? {};
  const rows: Row[] = data.rows ?? (Array.isArray(data) ? data : []);
  return [
    ui.header({ badge: "CSV", title: "CSV query", subtitle: plural(data.total ?? rows.length, "matching row") }),
    rows.length ? ui.table(rows) : ui.empty("No rows match."),
    data.truncated ? ui.footer(view, `Showing the first ${rows.length} of ${data.total}`) : null,
  ];
}

const views: Record<string, (view: View) => Content> = {
  datagovhk_search_datasets: search,
  datagovhk_dataset_details: details,
  datagovhk_archive_list_files: archiveFiles,
  datagovhk_archive_file_versions: versions,
  datagovhk_archive_get_file: file,
  datagovhk_filter_csv: csv,
};

mount({
  accent: "#5b3fa0",
  render(view) {
    if (view.status === "loading") return [ui.header({ badge: "DATA", title: view.input.query || view.input.id || "DATA.GOV.HK", subtitle: "Searching the catalogue…" }), ui.skeleton(3)];
    const draw = view.tool ? views[view.tool] : undefined;
    return draw ? draw(view) : ui.generic(view.data);
  },
});
