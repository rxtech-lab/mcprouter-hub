import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { parseService } from "@/mcp/codegen";
import { serviceSpec } from "@/mcp/schema";

const fixture = readFileSync(path.join(import.meta.dirname, "fixtures/example.yaml"), "utf8");
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixtures are mutated freely to build invalid specs
const base = () => parse(fixture) as Record<string, any>;

function issues(value: unknown) {
  const result = serviceSpec.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("service.yaml schema", () => {
  it("accepts the full-featured fixture and applies defaults", () => {
    const spec = serviceSpec.parse(base());
    expect(spec.tools[0].method).toBe("GET");
    expect(spec.tools[0].response?.format).toBe("json");
    expect(spec.tools[2].input.flag.required).toBe(false);
  });

  it("accepts every committed service", () => {
    const dir = path.join(import.meta.dirname, "../mcp/services");
    for (const name of ["hko-weather", "hk-bus", "mtr", "ha-aed", "td-carpark", "hk-holidays", "datagovhk-catalog"]) {
      expect(issues(parse(readFileSync(path.join(dir, name, "service.yaml"), "utf8"))), name).toEqual([]);
    }
  });

  it("rejects a tool with neither path nor handler", () => {
    const spec = base();
    delete spec.tools[2].handler;
    expect(issues(spec)).toContain("tool example_custom needs a path or a handler");
  });

  it("rejects a path placeholder without an input", () => {
    const spec = base();
    spec.tools[0].path = "/items/{category}/{missing}";
    expect(issues(spec).join()).toMatch(/\{missing\} but no input declares it/);
  });

  it("rejects duplicate tool names", () => {
    const spec = base();
    spec.tools[1].name = "example_items";
    expect(issues(spec)).toContain("duplicate tool name example_items");
  });

  it("rejects a body on a GET tool", () => {
    const spec = base();
    spec.tools[1].method = "GET";
    expect(issues(spec).join()).toMatch(/body is only allowed with POST/);
  });

  it("rejects unknown keys, bad ids and bad defaults", () => {
    expect(issues({ ...base(), surprise: 1 }).join()).toMatch(/Unrecognized key/);
    expect(issues({ ...base(), id: "Not_Kebab" }).join()).toMatch(/kebab-case/);
    const spec = base();
    spec.tools[0].input.lang.default = "fr";
    expect(issues(spec)).toContain("default must be one of enum");
  });

  it("rejects responses that refer to undeclared inputs", () => {
    const spec = base();
    spec.tools[0].response.filter = { code: "nope" };
    expect(issues(spec).join()).toMatch(/undeclared input nope/);
  });

  it("rejects an empty transform and a transform on a handler tool", () => {
    const empty = base();
    empty.tools[3].transform = {};
    expect(issues(empty)).toContain("transform needs a request or a response transformer");
    const both = base();
    both.tools[2].transform = { response: "unwrapFeed" };
    expect(issues(both)).toContain("tool example_custom: a handler already makes the request, so it cannot also have a transform");
  });

  it("checks handlers and directory names in parseService", () => {
    const missingFile = parseService({ directory: "example", yaml: fixture, handlerExports: null });
    expect(missingFile.problems.join()).toMatch(/handlers.ts does not exist/);
    const missingExport = parseService({ directory: "example", yaml: fixture, handlerExports: new Set(["other"]) });
    expect(missingExport.problems.join()).toMatch(/does not export it/);
    const wrongDir = parseService({ directory: "elsewhere", yaml: fixture, handlerExports: new Set(["custom", "signRequest", "unwrapFeed"]) });
    expect(wrongDir.problems.join()).toMatch(/must match its directory name/);
    const missingTransformer = parseService({ directory: "example", yaml: fixture, handlerExports: new Set(["custom", "signRequest"]) });
    expect(missingTransformer.problems).toEqual([
      'mcp/services/example/service.yaml: tool example_transformed uses response transformer "unwrapFeed" but handlers.ts does not export it',
    ]);
    const invalidYaml = parseService({ directory: "example", yaml: "tools: [", handlerExports: null });
    expect(invalidYaml.problems.join()).toMatch(/invalid YAML/);
  });
});
