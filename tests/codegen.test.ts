import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildManifest, CodegenError, findExports, generate, variableName, zodFor } from "@/mcp/codegen";
import { services } from "@/generated/registry";
import { serviceSpec } from "@/mcp/schema";

const root = path.join(import.meta.dirname, "..");
const fixture = readFileSync(path.join(import.meta.dirname, "fixtures/example.yaml"), "utf8");

describe("codegen", () => {
  it("generates a stable service module", () => {
    const files = generate([{ directory: "example", yaml: fixture, handlerExports: new Set(["custom", "signRequest", "unwrapFeed"]) }]);
    expect(files.get("generated/services/example.ts")).toMatchSnapshot();
    expect(files.get("generated/registry.ts")).toMatchSnapshot();
    expect(JSON.parse(files.get("generated/manifest.json")!)).toEqual({
      services: [
        {
          id: "example",
          title: "Example Service",
          description: "A fixture covering every feature of the YAML spec.",
          aliases: [],
          datasets: ["example-dataset"],
          apis: [],
          tools: [
            { name: "example_items", description: "Items, filtered locally." },
            { name: "example_submit", description: "POST with a body." },
            { name: "example_custom", description: "Uses a handler." },
            { name: "example_transformed", description: "YAML request with code transformers." },
          ],
        },
      ],
      datasets: { "example-dataset": ["example"] },
    });
  });

  it("maps params to zod", () => {
    expect(zodFor({ type: "string", required: true })).toBe("z.string()");
    expect(zodFor({ type: "string", enum: ["a", "b"], default: "a", required: false })).toBe('z.enum(["a","b"]).default("a")');
    expect(zodFor({ type: "integer", minimum: 1, maximum: 5, required: false, description: "n" })).toBe('z.number().int().min(1).max(5).describe("n").optional()');
    expect(zodFor({ type: "number", enum: [1, 2], required: true })).toBe("z.union([z.literal(1), z.literal(2)])");
    expect(zodFor({ type: "string", pattern: "^\\d+$", required: true })).toBe('z.string().regex(new RegExp("^\\\\d+$"))');
    expect(zodFor({ type: "boolean", default: false, required: false })).toBe("z.boolean().default(false)");
  });

  it("checks that a service's app section and app.ts go together", () => {
    const withApp = fixture.replace("\ntools:\n", "\napp: {}\ntools:\n");
    const exports = new Set(["custom", "signRequest", "unwrapFeed"]);
    expect(() => generate([{ directory: "example", yaml: withApp, handlerExports: exports, appScript: null }])).toThrow(/app.ts does not exist/);
    expect(() => generate([{ directory: "example", yaml: fixture, handlerExports: exports, appScript: "1" }])).toThrow(/has no app section/);
    const generated = generate([{ directory: "example", yaml: withApp, handlerExports: exports, appScript: "render()" }]).get("generated/services/example.ts")!;
    expect(generated).toContain('"script": "render()"');
    expect(generated).toContain('"resourceDomains": []');
  });

  it("finds handler exports and names variables", () => {
    expect([...findExports("export const a = 1;\nexport async function b() {}\nconst c = 2;")]).toEqual(["a", "b"]);
    expect(variableName("hko-weather")).toBe("hkoWeather");
  });

  it("reports tool names reused across services", () => {
    const other = fixture.replace(/\n  - name: example_transformed[\s\S]*$/, "\n").replace("id: example", "id: example-two").replace(/handler: custom/, "path: /x").replace("datasets: [example-dataset]", "datasets: []");
    expect(() =>
      generate([
        { directory: "example", yaml: fixture, handlerExports: new Set(["custom", "signRequest", "unwrapFeed"]) },
        { directory: "example-two", yaml: other, handlerExports: null },
      ]),
    ).toThrow(CodegenError);
  });

  it("reports a service id or alias claimed twice", () => {
    const tool = (name: string) => `tools:\n  - name: ${name}\n    description: x\n    handler: h\n`;
    const result = () =>
      generate([
        { directory: "a", yaml: `id: a\ntitle: A\naliases: [old]\n${tool("t_a")}`, handlerExports: new Set(["h"]) },
        { directory: "b", yaml: `id: b\ntitle: B\naliases: [old]\n${tool("t_b")}`, handlerExports: new Set(["h"]) },
      ]);
    expect(result).toThrow(/service id old is used by both a and b/);
  });

  it("resolves aliases of merged services in the registry", async () => {
    const { serviceById } = await import("@/generated/registry");
    expect(serviceById.get("kmb")?.id).toBe("hk-bus");
    expect(serviceById.get("citybus")?.id).toBe("hk-bus");
  });

  it("builds a manifest that maps datasets to every service listing them", () => {
    const a = serviceSpec.parse({ id: "a", title: "A", datasets: ["d1", "d2"], tools: [{ name: "t_a", description: "x", handler: "h" }] });
    const b = serviceSpec.parse({ id: "b", title: "B", datasets: ["d2"], tools: [{ name: "t_b", description: "x", handler: "h" }] });
    expect(buildManifest([a, b]).datasets).toEqual({ d1: ["a"], d2: ["a", "b"] });
  });

  it("matches the committed generated output, including APIS.md", () => {
    const servicesDir = path.join(root, "mcp/services");
    const sources = readdirSync(servicesDir).map((directory) => {
      const handlers = path.join(servicesDir, directory, "handlers.ts");
      const hasApp = existsSync(path.join(servicesDir, directory, "app.ts"));
      return {
        directory,
        yaml: readFileSync(path.join(servicesDir, directory, "service.yaml"), "utf8"),
        handlerExports: existsSync(handlers) ? findExports(readFileSync(handlers, "utf8")) : null,
        // Bundling app.ts needs Bun, so take the bundle codegen wrote; this checks everything around it.
        appScript: hasApp ? (services.find((service) => service.id === directory)?.app?.script ?? "missing") : null,
      };
    });
    const files = generate(sources, readFileSync(path.join(root, "mcp/apps/styles.css"), "utf8"), readFileSync(path.join(root, "mcp/apis.yaml"), "utf8"));
    expect(files.has("APIS.md")).toBe(true);
    for (const [file, content] of files) {
      expect(readFileSync(path.join(root, file), "utf8"), `${file} is stale; run bun run codegen`).toBe(content);
    }
  });
});
