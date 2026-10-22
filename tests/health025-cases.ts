import { readFileSync } from "node:fs";
import { services } from "@/generated/registry";
import { buildRequest } from "@/lib/mcp/runtime";
import manifest from "./fixtures/health025/manifest.json";
export const entries025 = manifest;
export const fixture025 = (file: string) => readFileSync(new URL(`./fixtures/health025/${file}`, import.meta.url), "utf8");
export function definition025(name: string) {
  const service = services.find((s) => s.tools.some((t) => t.name === name))!;
  return { service, tool: service.tools.find((t) => t.name === name)! };
}
export const cases025 = manifest.flatMap((entry) => ["en", "tc", "sc"].map((lang) => {
  const file = entry.kind === "statistics" ? `${entry.id}-${lang}.json` : `${entry.id}.${entry.kind === "flu" ? "csv" : "json"}`;
  const raw = fixture025(file);
  const reply = entry.kind === "flu" ? raw : JSON.parse(raw);
  const input = { lang, limit: 2 };
  const { service, tool } = definition025(entry.tool);
  return { ...entry, file, reply, input, request: { url: buildRequest(service, tool.spec, input).url } };
}));
