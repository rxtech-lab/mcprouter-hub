// Beach water quality MCP App: the latest grade of each bathing beach, grouped by district.
import { fmt, h, mount, ui, type Content, type Tone, type View } from "../../apps/runtime";
import type { Beach } from "./handlers";

const TONES: Record<number, Tone> = { 1: "success", 2: "info", 3: "warning", 4: "danger" };

function gradeChip(beach: Beach) {
  return beach.grade ? ui.chip(`${beach.rating} · ${beach.grade}`, TONES[beach.grade]) : ui.chip("Not graded");
}

function beaches(view: View) {
  const list: Beach[] = view.data?.beaches ?? [];
  const poor = list.filter((beach) => (beach.grade ?? 0) >= 3);
  const districts = [...new Set(list.map((beach) => beach.district ?? "Other"))];
  return [
    ui.header({
      badge: "≈",
      title: "Beach water quality",
      subtitle: `${list.length} ${list.length === 1 ? "beach" : "beaches"}${view.data?.updated ? ` · graded ${fmt.dateTime(view.data.updated)}` : ""}`,
      actions: [ui.refreshButton()],
    }),
    poor.length ? ui.notice(`Below the swimming standard: ${poor.map((beach) => beach.name).join(", ")}`, "warning") : null,
    list.length
      ? districts.map((district) =>
          ui.section(
            district,
            ui.list(
              list
                .filter((beach) => (beach.district ?? "Other") === district)
                .map((beach) => ui.row({ leading: ui.badge(beach.code), title: beach.name, subtitle: beach.note ?? null, trailing: h("span", { class: "chips" }, gradeChip(beach), ui.mapButton(beach.latitude, beach.longitude)) })),
            ),
          ),
        )
      : ui.empty("No beach matches."),
    h("footer", { class: "footer" }, "Grades 1 (Good) and 2 (Fair) meet the swimming standard. Based on the last five E. coli counts."),
  ];
}

const views: Record<string, (view: View) => Content> = {
  beach_water_quality: beaches,
};

mount({
  accent: "#00838f",
  render(view) {
    if (view.status === "loading") return [ui.header({ badge: "≈", title: "Beach water quality", subtitle: "Checking the beaches…" }), ui.skeleton(3)];
    const draw = view.tool ? views[view.tool] : undefined;
    return draw ? draw(view) : ui.generic(view.data);
  },
});
