import { describe, expect, it } from "vitest";
import { serviceById, services } from "@/generated/registry";
import { registerServices } from "@/lib/mcp/register";

type Registered = { name: string; config: { _meta?: { ui?: { resourceUri?: string } } }; handler: (input: object) => Promise<unknown> };

function fakeServer() {
  const names: string[] = [];
  const tools: Registered[] = [];
  const resources: Array<{ name: string; uri: string; config: { mimeType?: string }; read: () => Promise<{ contents: Array<{ text: string }> }> }> = [];
  const server = {
    registerTool: (name: string, config: Registered["config"], handler: Registered["handler"]) => {
      names.push(name);
      tools.push({ name, config, handler });
    },
    registerResource: (name: string, uri: string, config: { mimeType?: string }, read: () => Promise<{ contents: Array<{ text: string }> }>) =>
      void resources.push({ name, uri, config, read }),
  };
  return { names, tools, resources, server: server as never };
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
    registerServices(server, services, { userId: "u", apiKeyId: "k", scopes: ["mtr"] });
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((name) => name.startsWith("mtr_"))).toBe(true);
  });

  it("registers buses and minibuses together under one service", () => {
    const { names, server } = fakeServer();
    registerServices(server, services, { userId: "u", apiKeyId: "k", scopes: ["hk-bus"] });
    expect(names).toEqual(["bus"]);
  });

  it("registers one MCP App per service and points its tools at it", async () => {
    const { tools, resources, server } = fakeServer();
    registerServices(server, services, { userId: "u", apiKeyId: "k", scopes: ["mtr"] });
    expect(resources.map((resource) => resource.uri)).toEqual(["ui://mcprouter/mtr"]);
    expect(resources[0].config.mimeType).toBe("text/html;profile=mcp-app");
    expect((await resources[0].read()).contents[0].text).toContain("<!doctype html>");
    expect(tools.every((tool) => tool.config._meta?.ui?.resourceUri === "ui://mcprouter/mtr")).toBe(true);
  });

  it("keeps keys scoped to a merged service working", () => {
    for (const legacy of ["kmb", "citybus"]) {
      const { names, server } = fakeServer();
      registerServices(server, services, { userId: "u", apiKeyId: "k", scopes: [legacy] });
      expect(names).toEqual(serviceById.get("hk-bus")!.tools.map((tool) => tool.name));
    }
  });

  it("hides every tool behind search_tools, read_tool and use_tool in search mode, keeping key scopes", async () => {
    const { tools, resources, server } = fakeServer();
    registerServices(server, services, { userId: "u", apiKeyId: "k", scopes: ["mtr"] }, "search");
    expect(tools.map((tool) => tool.name)).toEqual(["search_tools", "read_tool", "use_tool"]);
    expect(resources.map((resource) => resource.uri)).toEqual(["ui://mcprouter/mtr"]);
    const read = tools.find((tool) => tool.name === "read_tool")!;
    const outOfScope = (await read.handler({ name: "hko_current_weather" })) as { isError?: boolean };
    expect(outOfScope.isError).toBe(true);
  });
});
