import { readFileSync } from "node:fs";
import manifest from "./fixtures/batch094/manifest.json";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import type { ToolInput } from "@/lib/mcp/types";

export const batch094 = manifest.filter((c) => c.lang === "en");
export const localized094 = manifest;
export type Entry094 = typeof manifest[number];
export const fixture094 = (c: Entry094) => JSON.parse(readFileSync(new URL(`./fixtures/batch094/${c.file}`, import.meta.url), "utf8"));
export function definition094(c: Entry094) {
  const service = services.find((s) => s.id === "censtatd-population-vital")!;
  return { service, tool: service.tools.find((t) => t.name === c.tool)! };
}
export function call094(c: Entry094, input: ToolInput = {}) {
  const { service, tool } = definition094(c);
  return executeTool(service, tool, { lang: c.lang, ...input });
}
export const cases094 = batch094.map((c) => {
  const source = fixture094(c);
  const rows = [...source.dataSet].sort((a, b) => String(b.period).localeCompare(String(a.period)));
  return { tool: c.tool, input: { limit: 1 }, request: { url: c.url }, reply: source,
    data: { table: c.table, title: source.header.title, language: "en", notes: source.header.tablenote, source: source.header.source,
      total: rows.length, results: [{ ...rows[0], measure: rows[0].svDesc }], returned: 1, hasMore: rows.length > 1, nextOffset: rows.length > 1 ? 1 : null }, ttl: 3600 };
});
