import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildManifest, CodegenError, findExports, generate, variableName, zodFor } from "@/mcp/codegen";
import { serviceSpec } from "@/mcp/schema";

const root = path.join(import.meta.dirname, "..");
const fixture = readFileSync(path.join(import.meta.dirname, "fixtures/example.yaml"), "utf8");

describe("codegen", () => {
  it("generates a stable service module", () => {
    const files = generate([{ directory: "example", yaml: fixture, handlerExports: new Set(["custom"]) }]);
    expect(files.get("generated/services/example.ts")).toMatchSnapshot();
    expect(files.get("generated/registry.ts")).toMatchSnapshot();
    expect(JSON.parse(files.get("generated/manifest.json")!)).toEqual({
      services: [
        {
          id: "example",
          title: "Example Service",
          description: "A fixture covering every feature of the YAML spec.",
          datasets: ["example-dataset"],
          tools: [
            { name: "example_items", description: "Items, filtered locally." },
            { name: "example_submit", description: "POST with a body." },
            { name: "example_custom", description: "Uses a handler." },
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

  it("finds handler exports and names variables", () => {
    expect([...findExports("export const a = 1;\nexport async function b() {}\nconst c = 2;")]).toEqual(["a", "b"]);
    expect(variableName("hko-weather")).toBe("hkoWeather");
  });

  it("reports tool names reused across services", () => {
    const other = fixture.replace("id: example", "id: example-two").replace(/handler: custom/, "path: /x").replace("datasets: [example-dataset]", "datasets: []");
    expect(() =>
      generate([
        { directory: "example", yaml: fixture, handlerExports: new Set(["custom"]) },
        { directory: "example-two", yaml: other, handlerExports: null },
      ]),
    ).toThrow(CodegenError);
  });

  it("builds a manifest that maps datasets to every service listing them", () => {
    const a = serviceSpec.parse({ id: "a", title: "A", datasets: ["d1", "d2"], tools: [{ name: "t_a", description: "x", handler: "h" }] });
    const b = serviceSpec.parse({ id: "b", title: "B", datasets: ["d2"], tools: [{ name: "t_b", description: "x", handler: "h" }] });
    expect(buildManifest([a, b]).datasets).toEqual({ d1: ["a"], d2: ["a", "b"] });
  });

  it("matches the committed generated output", () => {
    const servicesDir = path.join(root, "mcp/services");
    const sources = readdirSync(servicesDir).map((directory) => {
      const handlers = path.join(servicesDir, directory, "handlers.ts");
      return {
        directory,
        yaml: readFileSync(path.join(servicesDir, directory, "service.yaml"), "utf8"),
        handlerExports: existsSync(handlers) ? findExports(readFileSync(handlers, "utf8")) : null,
      };
    });
    for (const [file, content] of generate(sources)) {
      expect(readFileSync(path.join(root, file), "utf8"), `${file} is stale; run bun run codegen`).toBe(content);
    }
  });
});
