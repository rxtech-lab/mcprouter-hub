import type { ToolSpec } from "./schema";

/** The public contract keeps each operation's required arguments and defaults discoverable. */
export function combinedDescription(description: string | undefined, tools: Pick<ToolSpec, "name" | "description" | "input">[]) {
  return [description, "Choose an action and supply its arguments as top-level fields. Only the chosen action's arguments are used.", ...tools.map((tool) =>
    `${tool.name}: ${tool.description} Arguments: ${Object.entries(tool.input).map(([name, param]) =>
      `${name} (${param.type}${param.required ? ", required" : ", optional"}${param.default !== undefined ? `, default ${JSON.stringify(param.default)}` : ""}${param.enum ? `, one of ${param.enum.join(" / ")}` : ""})${param.description ? `: ${param.description}` : ""}`,
    ).join("; ") || "none"}`,
  )].filter(Boolean).join("\n");
}
