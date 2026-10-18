import { describe, expect, it } from "vitest";
import { filterApis } from "@/lib/apis";
import { renderApisMarkdown, resolveApis, type ApiEntry } from "@/mcp/apis";
import { serviceSpec } from "@/mcp/schema";

const registry = (entries: string) => `apis:\n${entries}`;
const entry = (id: string, datasets = ["d1"]) =>
  `  - { id: ${id}, title: T ${id}, description: D, provider: P, category: transport, datasets: [${datasets.join(", ")}] }\n`;
const service = (apis: string[], datasets = ["d1"]) =>
  serviceSpec.parse({ id: "svc", title: "Service", apis, datasets, tools: [{ name: "t", description: "x", handler: "h" }] });

describe("API tracker", () => {
  it("marks APIs a service lists as implemented and the rest as coming soon", () => {
    const { tracker, problems } = resolveApis(registry(entry("API-0001") + entry("API-0003", ["d2"])), [service(["API-0001"])]);
    expect(problems).toEqual([]);
    expect(tracker!.apis.map((api) => [api.id, api.status, api.services])).toEqual([
      ["API-0001", "implemented", ["svc"]],
      ["API-0003", "coming-soon", []],
    ]);
    expect(tracker!.counts).toEqual({ implemented: 1, "coming-soon": 1 });
    expect(tracker!.nextId).toBe("API-0004");
    expect(tracker!.apis[1].docs).toBe("https://data.gov.hk/en-data/dataset/d2");
  });

  it("rejects duplicate or out-of-order ids", () => {
    expect(resolveApis(registry(entry("API-0002") + entry("API-0002")), []).problems.join()).toMatch(/unique and ascending/);
    expect(resolveApis(registry(entry("API-0002") + entry("API-0001")), []).problems.join()).toMatch(/unique and ascending/);
    expect(resolveApis(registry(entry("API-12")), []).problems.join()).toMatch(/API ids look like/);
  });

  it("checks services against the registry", () => {
    const yaml = registry(entry("API-0001"));
    expect(resolveApis(yaml, [service(["API-0009"])]).problems.join()).toMatch(/API-0009 is not in mcp\/apis.yaml/);
    expect(resolveApis(yaml, [service([])]).problems.join()).toMatch(/list the mcp\/apis.yaml ids/);
    expect(resolveApis(yaml, [service(["API-0001"], [])]).problems.join()).toMatch(/datasets: must include d1/);
    expect(resolveApis(yaml, [service(["API-0001"], ["d1", "extra"])]).problems.join()).toMatch(/dataset extra is not part of any API/);
  });

  it("renders the README with ids, statuses and services", () => {
    const specs = [service(["API-0001"])];
    const { tracker } = resolveApis(registry(entry("API-0001") + entry("API-0002", ["d2"])), specs);
    const markdown = renderApisMarkdown(tracker!, specs);
    expect(markdown).toContain("**1 of 2 implemented**");
    expect(markdown).toContain("| `API-0001` | [T API-0001](https://data.gov.hk/en-data/dataset/d1) | API | P | ✅ Implemented | [Service](mcp/services/svc/service.yaml) |");
    expect(markdown).toContain("| `API-0002` | [T API-0002](https://data.gov.hk/en-data/dataset/d2) | API | P | 🕒 Coming soon | — |");
    expect(markdown).toContain("`API-0003`");
  });

  it("filters by text, status and category", () => {
    const api = (id: string, status: ApiEntry["status"], category: ApiEntry["category"]): ApiEntry => ({
      id, title: `Title ${id}`, description: "", provider: "HKO", category, datasets: [`ds-${id}`], kind: id === "API-0002" ? "files" : "api", docs: "", status, services: [],
    });
    const apis = [api("API-0001", "implemented", "weather"), api("API-0002", "coming-soon", "transport")];
    expect(filterApis(apis, { kind: "files" }).map((row) => row.id)).toEqual(["API-0002"]);
    expect(filterApis(apis, { status: "coming-soon" }).map((row) => row.id)).toEqual(["API-0002"]);
    expect(filterApis(apis, { category: "weather" }).map((row) => row.id)).toEqual(["API-0001"]);
    expect(filterApis(apis, { query: "api-0002" }).map((row) => row.id)).toEqual(["API-0002"]);
    expect(filterApis(apis, { query: "ds-API-0001" }).map((row) => row.id)).toEqual(["API-0001"]);
  });
});
