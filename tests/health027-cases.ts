import { readFileSync } from "node:fs";
import { services } from "@/generated/registry";
import manifest from "./fixtures/health027/manifest.json";
export const entries027 = manifest;
export function definition027(name: string) {
  const service = services.find((s) => s.tools.some((t) => t.name === name))!;
  return { service, tool: service.tools.find((t) => t.name === name)! };
}
export const cases027 = manifest.map((entry) => ({ ...entry,
  reply: JSON.parse(readFileSync(new URL(`./fixtures/health027/${entry.file}`, import.meta.url), "utf8")),
  request: { url: entry.url },
}));
