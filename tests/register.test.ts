import { describe, expect, it } from "vitest";
import { services } from "@/generated/registry";
import { registerServices } from "@/lib/mcp/register";

function fakeServer() {
  const names: string[] = [];
  return { names, server: { registerTool: (name: string) => void names.push(name) } as never };
}

describe("registerServices", () => {
  it("registers every tool for an unscoped key", () => {
    const { names, server } = fakeServer();
    registerServices(server, services, { userId: "u", apiKeyId: "k", scopes: [] });
    expect(names.length).toBe(services.reduce((sum, service) => sum + service.tools.length, 0));
    expect(new Set(names).size).toBe(names.length);
  });

  it("registers only the services a key is scoped to", () => {
    const { names, server } = fakeServer();
    registerServices(server, services, { userId: "u", apiKeyId: "k", scopes: ["kmb"] });
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((name) => name.startsWith("kmb_"))).toBe(true);
  });
});
