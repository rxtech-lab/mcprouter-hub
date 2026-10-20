import { describe, expect, it } from "vitest";
import { services } from "@/generated/registry";
import { hkDate, liveCases } from "@/mcp/live-checks";

describe("live check inputs", () => {
  const tools = services.flatMap((service) => service.tools.flatMap((tool) => [tool, ...(tool.operations ?? [])]));

  it("cover every tool, so the scheduled live check calls it", () => {
    expect(tools.map((tool) => tool.name).filter((name) => !liveCases[name])).toEqual([]);
  });

  it("only name tools that exist", () => {
    const names = new Set(tools.map((tool) => tool.name));
    expect(Object.keys(liveCases).filter((name) => !names.has(name))).toEqual([]);
  });

  it("pass each tool's input schema", () => {
    for (const tool of tools) {
      const input = liveCases[tool.name]?.input;
      if (input && typeof input !== "function") expect(tool.inputSchema.safeParse(input).success, tool.name).toBe(true);
    }
  });

  it("dates days in Hong Kong time", () => {
    expect(hkDate(0, new Date("2026-10-18T16:30:00Z"))).toBe("20261019");
    expect(hkDate(-1, new Date("2026-10-18T15:30:00Z"))).toBe("20261017");
  });
});
